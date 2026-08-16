const {GoogleGenAI} = require("@google/genai")
const { z } = require("zod")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
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

/* gemini-3.5-flash writes slightly richer reports but is often capacity throttled,
   it returns 503 and takes about 30s, so we use flash-lite which answers in about 4s */
const MODEL = "gemini-3.1-flash-lite"
const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1000
/* 429 is rate limited, 500 and 503 are google being overloaded, all worth retrying */
const TRANSIENT_STATUS_CODES = [429, 500, 503]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/* the google sdk puts the http status inside the serialised error message */
function isTransientError(err){
    return TRANSIENT_STATUS_CODES.some(code => String(err.message).includes(`"code":${code}`))
}

async function generateInterviewReport({resume, selfDescription, jobDescription}){

    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`;

    let lastError

    for(let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++){
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: z.toJSONSchema(interviewReportSchema)
                }
            });

            return JSON.parse(response.text)
        } catch (err) {
            lastError = err

            /* a bad prompt or a bad api key will fail the same way every time, so don't retry those */
            if(!isTransientError(err) || attempt === MAX_ATTEMPTS){
                break
            }

            /* back off 1s then 2s so we don't hammer a model that is already overloaded */
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
            console.warn(`${MODEL} attempt ${attempt} of ${MAX_ATTEMPTS} failed, retrying in ${delay}ms`)
            await sleep(delay)
        }
    }

    console.error("Failed to generate interview report:", lastError);
    throw lastError

}

module.exports  = generateInterviewReport