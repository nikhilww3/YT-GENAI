const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const crypto = require("crypto")
const { isTransientGeminiError, withRetry } = require("../utils/retryUtils")

/*
 * Suggestion generation, held to one rule above all others: NOTHING may be
 * invented.
 *
 * A model asked to satisfy a job description will happily write "Led a team of
 * 12 engineers to cut latency 40%" for a candidate who did neither. That lands
 * on a real resume, goes into a real interview, and is a far worse outcome for
 * the user than a low score. So suggestions may only draw on the candidate's own
 * source material — the resume they uploaded and what they wrote about
 * themselves — and where a number is genuinely unknowable the model must leave a
 * blank for the human to fill rather than guess a plausible one.
 */
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
    httpOptions: { timeout: 60_000 }
})

const MODEL = "gemini-3.1-flash-lite"

// Cap set in the design: people act on a short ranked list and abandon a long one.
const MAX_SUGGESTIONS = 7

const suggestionsSchema = z.object({
    suggestions: z.array(z.object({
        kind: z.enum(["rewrite", "addition"]).describe(
            "'rewrite' replaces an existing bullet; 'addition' proposes a new bullet for an existing role or project"
        ),
        section: z.enum(["experience", "projects"]),
        entryIndex: z.number().describe("0-based index of the role or project this targets, in the order given"),
        bulletIndex: z.number().describe("0-based index of the bullet being rewritten; -1 for an addition"),
        currentText: z.string().describe("the existing bullet's text verbatim, or an empty string for an addition"),
        proposedText: z.string().describe(
            "the replacement or new bullet. Action + scope + measurable result, in the posting's language. " +
            "Where a figure is not present in the source material, write exactly ___ and never a guessed number"
        ),
        addresses: z.array(z.string()).describe("which of the posting's requirements this bullet would satisfy"),
        why: z.string().describe("one short sentence explaining what this gains, and which source material supports it"),
    })).max(MAX_SUGGESTIONS),
    untrueSkills: z.array(z.object({
        term: z.string(),
        note: z.string().describe("one sentence stating that the posting wants this and the source material shows no evidence of it"),
    })).describe(
        "Requirements the posting asks for that the candidate's source material gives NO evidence of. " +
        "These are gaps in the candidate, not in the document — never phrased as something to simply add."
    ),
})

function buildSuggestionsPrompt({ tailoredResume, sourceResume, selfDescription, jobDescription, keywords }) {
    const gaps = keywords
        .filter((k) => k.status !== "evidenced")
        .map((k) => `- ${k.term} (${k.status === "missing" ? "absent" : "listed but never demonstrated"})`)
        .join("\n")

    const roles = (tailoredResume.experience ?? []).map((role, i) =>
        `experience[${i}] ${role.title} at ${role.company} (${role.dates})\n` +
        (role.bullets ?? []).map((b, j) => `    bullet[${j}]: ${b}`).join("\n")
    ).join("\n")

    const projects = (tailoredResume.projects ?? []).map((project, i) =>
        `projects[${i}] ${project.name} (${project.tech})\n` +
        (project.bullets ?? []).map((b, j) => `    bullet[${j}]: ${b}`).join("\n")
    ).join("\n")

    return `You are improving a candidate's resume for a specific job posting.

ABSOLUTE RULE — you may only use facts that appear in the SOURCE MATERIAL below. The source material is the candidate's own uploaded resume and their own description of themselves. If the source material does not say the candidate did something, you may NOT write that they did. Inventing experience to satisfy the posting is the worst possible failure here: it puts a lie on a real resume.

Where a bullet would be stronger with a number and the source material does not give you one, write exactly ___ in its place. Never estimate, never write a "plausible" figure. A blank the candidate fills in is correct; an invented number is not.

Produce at most ${MAX_SUGGESTIONS} suggestions, ranked by how much they improve the match. Each one either rewrites an existing bullet or adds a new bullet to an existing role or project. Do not invent new roles or new projects. Write each bullet as action + scope + measurable result, using the posting's own vocabulary where it honestly applies.

Separately, list requirements the posting asks for where the source material shows NO evidence at all. Those go in untrueSkills — they are gaps in the candidate, not things to quietly add.

THE POSTING'S UNMET REQUIREMENTS:
${gaps || "(none)"}

CURRENT RESUME STRUCTURE (target your suggestions at these indices):
${roles}
${projects}

SOURCE MATERIAL — the candidate's uploaded resume:
${sourceResume}

SOURCE MATERIAL — what the candidate wrote about themselves:
${selfDescription || "(not provided)"}

JOB DESCRIPTION:
${jobDescription}
`
}

const MAX_CACHED = 50
const cache = new Map()
const inFlight = new Map()

function touch(key, value) {
    cache.delete(key)
    cache.set(key, value)
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value)
}

async function requestSuggestions(input) {
    const response = await withRetry(
        () => ai.models.generateContent({
            model: MODEL,
            contents: buildSuggestionsPrompt(input),
            config: {
                responseMimeType: "application/json",
                responseSchema: z.toJSONSchema(suggestionsSchema)
            }
        }),
        isTransientGeminiError,
        MODEL
    )

    const parsed = suggestionsSchema.parse(JSON.parse(response.text))

    /* needsInput is derived here rather than asked of the model: whether the text
       contains a blank is a fact about the string, and the UI depends on it to
       decide between one-click Apply and "insert and edit". A model that forgot
       to set a flag would otherwise let an unfilled ___ be applied silently. */
    return {
        ...parsed,
        suggestions: parsed.suggestions.map((s) => ({
            ...s,
            needsInput: s.proposedText.includes("___"),
        })),
    }
}

/**
 * Generates grounded improvement suggestions for the resume, cached on the exact
 * inputs so reopening the workbench does not re-spend a model call.
 */
async function suggestResumeImprovements(input) {
    const key = crypto.createHash("sha1")
        .update(JSON.stringify([input.tailoredResume, input.jobDescription, input.keywords]))
        .digest("hex")

    const cached = cache.get(key)
    if (cached) {
        touch(key, cached)
        return cached
    }

    if (!inFlight.has(key)) {
        const run = requestSuggestions(input).then((result) => {
            touch(key, result)
            return result
        })
        const cleanup = () => inFlight.delete(key)
        run.then(cleanup, cleanup)
        inFlight.set(key, run)
    }

    return inFlight.get(key)
}

module.exports = { suggestResumeImprovements, MAX_SUGGESTIONS }
