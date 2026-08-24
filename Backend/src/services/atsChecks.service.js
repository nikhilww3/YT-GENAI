/*
 * Mechanical ATS checks — deterministic, free, and instant. No model is involved
 * and none should be: every question here has a provable answer, and a provable
 * answer beats a confident guess.
 *
 * The leverage comes from holding both halves at once: the structured resume
 * content AND the text a parser actually extracted from the compiled PDF. Any
 * disagreement between them is, by definition, the layout losing information on
 * the way to the parser.
 */

/* Comparing rendered PDF text against source strings can't be done literally:
   LaTeX escaping, ligatures and line wrapping all change the characters. Fold
   both sides to bare lowercase words so the comparison survives that. */
function normalise(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

/* A short signature is more robust than the whole string: a long bullet may wrap
   or hyphenate, but its opening words survive intact. */
function signature(value, words = 6) {
    return normalise(value).split(" ").slice(0, words).join(" ")
}

const SECTION_HEADINGS = ["experience", "education", "skills"]

/**
 * @param {string} text  the compiled PDF's extracted text layer
 * @param {object} content  the structured tailoredResume the PDF was built from
 * @returns {Array<{id, label, status: "pass"|"warn"|"fail", detail}>}
 */
function runMechanicalChecks(text, content) {
    const checks = []
    const flat = normalise(text)

    /* 1. Did anything come out at all? An image-only or broken PDF extracts to
       nothing, and a parser would read nothing — the worst possible outcome, and
       one that looks completely fine to the human eye. */
    const extracted = flat.length > 0
    checks.push({
        id: "text-layer",
        label: "Text layer",
        status: extracted ? "pass" : "fail",
        detail: extracted
            ? `${flat.split(" ").length} words readable by a parser.`
            : "Nothing could be read from this PDF. An applicant tracking system would see an empty document.",
    })

    // Every later check reads the extracted text; without one they'd all report
    // failures that are really just this same single fault repeated.
    if (!extracted) return checks

    /* 2. Standard headings. Parsers map content to fields by looking for known
       section names; creative substitutes ("Where I've Been") leave the parser
       unable to tell experience from education. */
    const missingHeadings = SECTION_HEADINGS.filter((heading) => !flat.includes(heading))
    checks.push({
        id: "headings",
        label: "Section headings",
        status: missingHeadings.length === 0 ? "pass" : "warn",
        detail: missingHeadings.length === 0
            ? "Experience, Education and Skills all found under standard names."
            : `Not found under a standard name: ${missingHeadings.join(", ")}.`,
    })

    /* 3. Contact details. These are the fields an ATS most often auto-fills into
       an application form; if they don't survive extraction, a human never sees
       them however clearly they're printed. */
    const contactMissing = []
    if (content?.emailDisplay && !flat.includes(normalise(content.emailDisplay))) contactMissing.push("email")
    if (content?.phone && !flat.includes(normalise(content.phone))) contactMissing.push("phone")
    checks.push({
        id: "contact",
        label: "Contact details",
        status: contactMissing.length === 0 ? "pass" : "fail",
        detail: contactMissing.length === 0
            ? "Email and phone both survive extraction."
            : `Did not survive extraction: ${contactMissing.join(", ")}. A parser cannot fill these into an application form.`,
    })

    /* 4. Reading-order integrity — the check worth having. Parsers read one
       top-to-bottom stream, so a layout that reorders content (multi-column
       blocks, floats, complex tables) silently scrambles the story. We know the
       order the bullets were written in, so we can prove whether that order
       survived rather than eyeballing the PDF. */
    const sourceBullets = [
        ...(content?.experience ?? []).flatMap((role) => role.bullets ?? []),
        ...(content?.projects ?? []).flatMap((project) => project.bullets ?? []),
    ]

    const positions = sourceBullets
        .map((bullet) => ({ bullet, at: flat.indexOf(signature(bullet)) }))
        .filter((entry) => entry.bullet && signature(entry.bullet).length > 0)

    const unfound = positions.filter((entry) => entry.at === -1)
    const found = positions.filter((entry) => entry.at !== -1)
    const scrambled = found.some((entry, i) => i > 0 && entry.at < found[i - 1].at)

    let orderStatus = "pass"
    let orderDetail = `All ${found.length} bullet points extract in the order they were written.`
    if (scrambled) {
        orderStatus = "fail"
        orderDetail = "Bullet points extract out of order. The layout is scrambling the reading order, so a parser receives your history jumbled."
    } else if (unfound.length > 0) {
        orderStatus = "warn"
        orderDetail = `${unfound.length} of ${positions.length} bullet points could not be located in the extracted text — they may be rendering as images or losing characters.`
    }

    checks.push({ id: "reading-order", label: "Reading order", status: orderStatus, detail: orderDetail })

    return checks
}

module.exports = { runMechanicalChecks }
