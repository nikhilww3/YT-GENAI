const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const fs = require("fs/promises")
const fsSync = require("fs")
const os = require("os")
const path = require("path")
const crypto = require("crypto")
const { execFile } = require("child_process")
const Handlebars = require("handlebars")
const { deepEscapeLatex } = require("../utils/latexEscape")
const { sleep, MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, TRANSIENT_STATUS_CODES, isTransientGeminiError, withRetry } = require("../utils/retryUtils")

// Without an explicit timeout this falls through to undici's 5-minute headers
// timeout. That is exactly what happened in practice: a stalled Gemini call
// here hung, timed out as UND_ERR_HEADERS_TIMEOUT, and (before the unhandled
// rejection was fixed) took the whole server down with it.
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
    httpOptions: { timeout: 60_000 }
})

const tailoredResumeSchema = z.object({
    name: z.string(),
    location: z.string().describe("e.g. 'Jaipur, Rajasthan, India'"),
    phone: z.string(),
    emailDisplay: z.string().describe("the email address as it should be displayed"),
    emailUrl: z.string().describe("just the email address, no mailto: prefix"),
    linkedinDisplay: z.string().describe("display label for the LinkedIn link — usually just 'LinkedIn'"),
    linkedinUrl: z.string().describe("the LinkedIn profile URL, no https:// prefix"),
    githubDisplay: z.string().describe("display label for the GitHub link — usually just 'GitHub'"),
    githubUrl: z.string().describe("the GitHub profile URL, no https:// prefix"),
    summary: z.string().describe("2-3 sentence professional summary tailored to the job description, grounded only in the candidate's actual resume/self-description"),
    education: z.array(z.object({
        institution: z.string(),
        location: z.string(),
        degree: z.string(),
        dates: z.string(),
    })).describe("Every education entry from the original resume, same order, unchanged facts"),
    experience: z.array(z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        dates: z.string(),
        bullets: z.array(z.string()).describe("Reworded to target the job description's language/keywords, but each bullet must stay close to the original bullet's word count"),
    })).describe("Every experience entry from the original resume, same order, same jobs — do not add, remove, or reorder entries"),
    projects: z.array(z.object({
        name: z.string(),
        tech: z.string(),
        dates: z.string(),
        linkUrl: z.string().optional().describe("a project URL (e.g. its GitHub repo) only if one is actually present in the source resume — never fabricated"),
        bullets: z.array(z.string()),
    })).describe("Every project entry from the original resume, same order — do not add, remove, or reorder entries"),
    skills: z.array(z.object({
        category: z.string(),
        items: z.array(z.string()),
    })).describe("May add a skill only if it's evidenced elsewhere in the resume/self-description (never fabricated), and may drop skills irrelevant to this job"),
})

const MODEL = "gemini-3.1-flash-lite"

/**
 * Calls Gemini to produce structured resume content (never raw LaTeX) tailored
 * to the job description. The AI only ever returns plain field values — it's
 * template-fill.js / Handlebars that turns those into LaTeX, so the model has
 * no way to break the document's syntax.
 */
async function generateTailoredResumeContent({ resume, selfDescription, jobDescription }) {
    const prompt = `You are tailoring a candidate's resume to a specific job description, to be inserted into a fixed one-page LaTeX resume template.

Original resume (extracted text):
${resume}

Candidate self-description (supplementary context):
${selfDescription || "(none provided)"}

Target job description:
${jobDescription}

Rules you must follow exactly:
1. Education, Experience, and Projects: include every entry from the original resume, in the SAME order. Do not add, remove, or reorder entries. Do not invent a job, degree, or project that isn't in the original resume.
2. Experience/Project bullets: reword each bullet to better match the job description's language and keywords, but keep each reworded bullet close to the same word count as the original bullet it replaces. Do not fabricate achievements, metrics, or responsibilities that aren't supported by the original resume or self-description.
3. Skills: you may add a skill only if it is genuinely evidenced somewhere in the resume or self-description (e.g. mentioned inside a project bullet but missing from the formal skills list) and is relevant to this job. You may remove skills that are irrelevant to this job. Never invent a skill that has no basis in the source material.
4. Summary: write a short, professional 2-3 sentence summary tailored to the job description, grounded only in the candidate's real background.
5. Project links: only include a project's linkUrl if a URL for it is actually present in the source resume text. Never invent one.
6. Tone: professional throughout.`

    return withRetry(
        () => ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: z.toJSONSchema(tailoredResumeSchema)
            }
        }),
        isTransientGeminiError,
        MODEL
    ).then(response => tailoredResumeSchema.parse(JSON.parse(response.text)))
}

/* Turns escaped per-field content into the flat set of ready-to-insert LaTeX
   fragments the template expects (multi-arg macro calls like
   \resumeSubheading{a}{b}{c}{d} are pre-assembled here, in plain JS string
   concatenation, rather than in the .hbs file — Handlebars' own {{{ }}}
   delimiters get ambiguous with literal braces sitting right next to them). */
function buildTemplateContext(content) {
    const escaped = deepEscapeLatex(content)

    return {
        headerName: `{\\Huge \\scshape ${escaped.name}}`,
        headerLocation: escaped.location,
        headerContact: `\\small ${escaped.phone} $|$ \\href{mailto:${escaped.emailUrl}}{\\underline{${escaped.emailDisplay}}} $|$ \\href{https://${escaped.linkedinUrl}}{\\underline{${escaped.linkedinDisplay}}} $|$ \\href{https://${escaped.githubUrl}}{\\underline{${escaped.githubDisplay}}}`,
        summary: escaped.summary,
        education: escaped.education.map(e => ({
            line1: `{${e.institution}}{${e.dates}}`,
            line2: `{${e.degree}}{${e.location}}`,
        })),
        experience: escaped.experience.map(e => ({
            headingLine1: `{${e.company}}{${e.dates}}`,
            headingLine2: `{${e.title}}{${e.location}}`,
            bullets: e.bullets,
        })),
        projects: escaped.projects.map(p => {
            const linkPart = p.linkUrl ? ` \\href{https://${p.linkUrl}}{[Link]}` : ""
            return {
                headingLine: `{\\textbf{${p.name}} $|$ \\emph{${p.tech}}${linkPart}}{${p.dates}}`,
                bullets: p.bullets,
            }
        }),
        skills: escaped.skills.map(s => ({
            line: `\\textbf{${s.category}}{: ${s.items.join(", ")}}`,
        })),
    }
}

let compiledTemplate
async function getCompiledTemplate() {
    if (!compiledTemplate) {
        const source = await fs.readFile(path.join(__dirname, "../templates/resume.tex.hbs"), "utf-8")
        compiledTemplate = Handlebars.compile(source, { noEscape: true })
    }
    return compiledTemplate
}

async function renderResumeTemplate(content) {
    const template = await getCompiledTemplate()
    return template(buildTemplateContext(content))
}

/* Prefer the binary scripts/setup-tectonic.sh installs (Backend/bin/tectonic)
   so it works out of the box after running the setup script; TECTONIC_PATH
   still overrides this, and bare "tectonic" is the last-resort PATH lookup. */
const LOCAL_TECTONIC_PATH = path.join(__dirname, "../../bin/tectonic")
const TECTONIC_PATH = process.env.TECTONIC_PATH
    || (fsSync.existsSync(LOCAL_TECTONIC_PATH) ? LOCAL_TECTONIC_PATH : "tectonic")
const COMPILE_TIMEOUT_MS = 60_000

/**
 * Compiles a .tex source string to a PDF buffer using Tectonic, in an
 * isolated temp directory that's always cleaned up afterward.
 */
async function compileLatexToPdf(texSource) {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "resume-compile-"))
    const texPath = path.join(workDir, "resume.tex")
    const pdfPath = path.join(workDir, "resume.pdf")

    try {
        await fs.writeFile(texPath, texSource, "utf-8")

        await new Promise((resolve, reject) => {
            execFile(
                TECTONIC_PATH,
                [texPath, "--outdir", workDir],
                { timeout: COMPILE_TIMEOUT_MS },
                (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Tectonic compile failed: ${stderr || error.message}`))
                        return
                    }
                    resolve()
                }
            )
        })

        return await fs.readFile(pdfPath)
    } finally {
        await fs.rm(workDir, { recursive: true, force: true })
    }
}

/**
 * Guards against stale cached content: a tailoredResume saved under an older
 * version of this schema (e.g. before a field was added) can't just be
 * trusted because it exists — it has to still match the schema the current
 * template actually needs, or rendering breaks on whatever's missing.
 */
function isValidTailoredResume(content) {
    return tailoredResumeSchema.safeParse(content).success
}

// In-memory only, deliberately — same rationale as the "never touches server
// disk or the database with the compiled PDF" comment on the controller.
// Keyed by interviewId, with a content hash so a regenerated tailoredResume
// (e.g. after a schema change invalidates the old one) can't serve a stale
// compile. Lost on restart, which is fine: worst case is one recompile.
//
// Bounded LRU, not a plain unbounded Map: without a cap this grows forever
// as distinct reports get downloaded across the process's lifetime, each
// holding a full PDF Buffer — a slow memory leak in a long-lived server.
// Map preserves insertion order, so re-inserting on every touch (get or set)
// keeps the least-recently-used entry at the front for O(1) eviction.
const MAX_CACHED_PDFS = 50
const compiledPdfCache = new Map() // interviewId -> { hash, buffer }
const inFlightPdfCompiles = new Map() // interviewId -> Promise<Buffer>

function touchCachedPdf(interviewId, entry) {
    compiledPdfCache.delete(interviewId)
    compiledPdfCache.set(interviewId, entry)
    if (compiledPdfCache.size > MAX_CACHED_PDFS) {
        const oldestKey = compiledPdfCache.keys().next().value
        compiledPdfCache.delete(oldestKey)
    }
}

/**
 * Compiles texSource to a PDF, reusing a cached buffer when this exact report
 * was already compiled from this exact content. Without this, every single
 * download re-ran the full Tectonic process spawn + typeset even when
 * nothing about the resume had changed since the last download.
 */
async function getOrCompileTailoredResumePdf(interviewId, texSource) {
    const hash = crypto.createHash("sha1").update(texSource).digest("hex")

    const cached = compiledPdfCache.get(interviewId)
    if (cached && cached.hash === hash) {
        touchCachedPdf(interviewId, cached)
        return cached.buffer
    }

    if (!inFlightPdfCompiles.has(interviewId)) {
        const compilation = compileLatexToPdf(texSource).then((buffer) => {
            touchCachedPdf(interviewId, { hash, buffer })
            return buffer
        })

        // Same not-.finally() reasoning as inFlightResumeGenerations above: a
        // bare .finally() here would produce an unhandled rejection on
        // compile failure even though the controller already catches it.
        const cleanup = () => inFlightPdfCompiles.delete(interviewId)
        compilation.then(cleanup, cleanup)
        inFlightPdfCompiles.set(interviewId, compilation)
    }

    return inFlightPdfCompiles.get(interviewId)
}

module.exports = { generateTailoredResumeContent, renderResumeTemplate, compileLatexToPdf, getOrCompileTailoredResumePdf, isValidTailoredResume }
