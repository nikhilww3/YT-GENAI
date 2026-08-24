const { GoogleGenAI } = require("@google/genai")
const OpenAI = require("openai")
const { z } = require("zod")
const { sleep, MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, TRANSIENT_STATUS_CODES, isTransientGeminiError, isTransientOpenAICompatibleError, withRetry } = require("../utils/retryUtils")

// Without an explicit timeout this falls through to undici's 5-minute headers
// timeout, and a stalled Gemini call ties up the request that whole time.
const GEMINI_TIMEOUT_MS = 60_000

const geminiClient = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
    httpOptions: { timeout: GEMINI_TIMEOUT_MS }
})


const interviewReportSchema = z.object({
    matchscore: z.number().describe("A score between 0 and 100 indicating how well the candidate's resume matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take, what to avoid etc...")
    })).describe("Technical questions that can be asked in the interview along with the intention of the question and how to answer it"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take, what to avoid etc...")
    })).describe("Behavioral questions that can be asked in the interview along with the intention of the question and how to answer it"),
    skillsGap: z.array(z.object({
        skill: z.string().describe("The skill that the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of the skill gap")
    })).describe("Skills that the candidate is lacking along with the severity of the skill gap"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day of the preparation plan"),
        focus: z.string().describe("The focus of the preparation plan for that day"),
        tasks: z.array(z.string()).describe("The tasks to be completed for that day")
    })).describe("Preparation plan for the candidate to improve their skills and prepare for the interview day by day"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

function buildPrompt({ resume, selfDescription, jobDescription }) {
    /* The resume and the self description are alternatives — only one of the two
       is required. Drop the absent one entirely instead of interpolating it as an
       empty string or the literal "undefined", either of which the model reads as
       a candidate with no history and scores down accordingly. */
    const details = [
        resume?.trim() && `Resume: ${resume.trim()}`,
        selfDescription?.trim() && `Self Description: ${selfDescription.trim()}`,
        `Job Description: ${jobDescription}`,
    ].filter(Boolean)

    return `Generate an interview report for a candidate with the following details:
                        ${details.join("\n                        ")}
`
}

/* gemini-3.5-flash writes slightly richer reports but is often capacity throttled,
   it returns 503 and takes about 30s, so we use flash-lite which answers in about 4s */
const GEMINI_MODEL = "gemini-3.1-flash-lite"

async function generateWithGemini(prompt) {
    return withRetry(
        () => geminiClient.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: z.toJSONSchema(interviewReportSchema)
            }
        }),
        isTransientGeminiError,
        GEMINI_MODEL
    ).then(response => interviewReportSchema.parse(JSON.parse(response.text)))
}

/* Gemini's native structured-output mode (responseSchema) isn't available on
   arbitrary OpenAI-compatible endpoints, so instead the exact required JSON
   shape is spelled out in the prompt itself, response_format is set to the
   more broadly-supported "json_object" (not the newer strict json_schema
   mode, which isn't guaranteed to be implemented by every backend a given
   model is served from), and the result is Zod-validated after parsing —
   if a smaller/weaker free model doesn't follow the shape, that surfaces as
   a clean validation error for this provider rather than a silent guess. */
const JSON_SHAPE_INSTRUCTIONS = `Respond with ONLY a single JSON object (no markdown code fences, no commentary before or after) matching exactly this shape:
{
  "title": string — the job title,
  "matchscore": number 0-100,
  "technicalQuestions": [{ "question": string, "intention": string, "answer": string }],
  "behavioralQuestions": [{ "question": string, "intention": string, "answer": string }],
  "skillsGap": [{ "skill": string, "severity": "low" | "medium" | "high" }],
  "preparationPlan": [{ "day": number, "focus": string, "tasks": [string] }]
}`

async function generateWithOpenAICompatible({ label, baseURL, apiKey, model }, prompt) {
    if (!apiKey) {
        throw new Error(`${label} is not configured — missing API key`)
    }

    // maxRetries: 0 is load-bearing, not a style choice. The SDK defaults to
    // maxRetries: 2 (3 attempts), and withRetry() below adds 3 more on top —
    // they MULTIPLY to 9 HTTP requests, each up to `timeout` ms. At the old
    // 90s timeout that was ~13 minutes before the user saw any failure, which
    // is what made NVIDIA feel like it hung forever. Retries are handled in
    // exactly one place (withRetry) so the worst case stays predictable:
    // 3 attempts x 60s + backoff ~= 3 minutes.
    const client = new OpenAI({ baseURL, apiKey, timeout: 60_000, maxRetries: 0 })

    return withRetry(
        () => client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: JSON_SHAPE_INSTRUCTIONS },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        }),
        isTransientOpenAICompatibleError,
        label
    ).then(response => {
        const content = response.choices[0]?.message?.content
        if (!content) {
            throw new Error(`${label} returned an empty response`)
        }
        return interviewReportSchema.parse(JSON.parse(content))
    })
}

/* OpenAI's own endpoint is the native case for generateWithOpenAICompatible, so
   baseURL is left off entirely and the SDK falls through to api.openai.com.
   The model is env-overridable because OpenAI retires ids on its own schedule —
   when gpt-5.6-luna is superseded, that should cost a line in .env, not a code
   change and a redeploy. Luna is the default: cheapest of the 5.6 family
   ($0.20/$1.20 per Mtok), and it supports the structured output this needs. */
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna"

const PROVIDERS = {
    gemini: {
        label: "Gemini",
        generate: (prompt) => generateWithGemini(prompt)
    },
    openai: {
        label: "ChatGPT",
        generate: (prompt) => generateWithOpenAICompatible({
            label: "ChatGPT",
            apiKey: process.env.OPENAI_API_KEY,
            model: OPENAI_MODEL
        }, prompt)
    },
    nvidia: {
        label: "NVIDIA",
        generate: (prompt) => generateWithOpenAICompatible({
            label: "NVIDIA",
            baseURL: "https://integrate.api.nvidia.com/v1",
            apiKey: process.env.NVIDIA_API_KEY,
            model: "meta/llama-3.3-70b-instruct"
        }, prompt)
    },
    huggingface: {
        label: "Hugging Face",
        generate: (prompt) => generateWithOpenAICompatible({
            label: "Hugging Face",
            baseURL: "https://router.huggingface.co/v1",
            apiKey: process.env.HUGGINGFACE_API_KEY,
            model: "meta-llama/Llama-3.1-8B-Instruct"
        }, prompt)
    }
}

/**
 * @description Generates an interview report using the given provider ("gemini" | "openai" |
 * "nvidia" | "huggingface"). Defaults to Gemini to preserve existing behavior for any caller
 * that doesn't specify one.
 */
async function generateInterviewReport({ resume, selfDescription, jobDescription, provider = "gemini" }) {
    const providerConfig = PROVIDERS[provider]

    if (!providerConfig) {
        throw new Error(`Unknown provider: ${provider}`)
    }

    const prompt = buildPrompt({ resume, selfDescription, jobDescription })

    try {
        return await providerConfig.generate(prompt)
    } catch (err) {
        console.error(`Failed to generate interview report via ${providerConfig.label}:`, err)
        throw err
    }
}

module.exports = generateInterviewReport
module.exports.PROVIDERS = PROVIDERS
