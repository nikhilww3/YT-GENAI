/* Maps each LaTeX-special character to its escaped form. Backslash must be
   escaped in the same pass as everything else — replace() scans the original
   string once, so the backslashes it inserts for other chars are never
   re-scanned and double-escaped. */
const LATEX_SPECIAL_CHARS = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "%": "\\%",
    "$": "\\$",
    "#": "\\#",
    "_": "\\_",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
}

function escapeLatex(value) {
    if (value === null || value === undefined) return ""
    return String(value).replace(/[\\&%$#_{}~^]/g, (char) => LATEX_SPECIAL_CHARS[char])
}

/* For \href targets: LaTeX-escaping would corrupt a real URL (e.g. "&" is
   meaningful in a query string), so instead of escaping we allowlist the
   characters a plain contact URL/mailto actually needs and drop the rest. */
function sanitizeUrl(value) {
    if (value === null || value === undefined) return ""
    return String(value).replace(/[^A-Za-z0-9.\-_+/:@?=]/g, "")
}

/* Recursively escapes every string in a plain object/array tree for safe
   LaTeX interpolation. Keys ending in "Url" are URL-sanitized instead, since
   they're used as \href targets, not printed text. */
function deepEscapeLatex(value, keyHint) {
    if (typeof value === "string") {
        return keyHint && keyHint.endsWith("Url") ? sanitizeUrl(value) : escapeLatex(value)
    }

    if (Array.isArray(value)) {
        return value.map((item) => deepEscapeLatex(item, keyHint))
    }

    if (value && typeof value === "object") {
        const result = {}
        for (const [key, val] of Object.entries(value)) {
            result[key] = deepEscapeLatex(val, key)
        }
        return result
    }

    return value
}

module.exports = { escapeLatex, sanitizeUrl, deepEscapeLatex }
