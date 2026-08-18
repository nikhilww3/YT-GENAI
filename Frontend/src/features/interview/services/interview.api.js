import axios from "axios";

// Without a timeout a stalled request leaves the UI spinning forever with no
// error. Set above the backend's own worst case (3 retries x 60s + backoff
// ~= 3 min) so a real backend error message wins the race and reaches the
// user, and this only fires when the backend itself has gone unresponsive.
const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
    timeout: 210_000,
})


/**
 * @description Generates one interview report per requested provider ("gemini" | "nvidia" |
 * "huggingface"), from the same resume PDF/self-description/job description. Returns
 * { message, results: [{ provider, providerLabel, status, interviewReport? , message? }] } —
 * each provider succeeds or fails independently, so a partial result set is normal, not an error.
 */
export const generateInterviewReport = async ({jobDescription, selfDescription, resumeFile, providers}) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)
    formData.append("providers", JSON.stringify(providers))

    try {
        // let axios/the browser set Content-Type so the multipart boundary is included
        const response = await api.post("/api/interview", formData)
        return response.data
    } catch (error) {
        // The backend returns 502 (not 2xx) when every requested provider failed, but the
        // body still has the same { message, results } shape with each failure reason — treat
        // that as data to show, not a generic thrown error, same as a partial success would be.
        if (Array.isArray(error.response?.data?.results)) {
            return error.response.data
        }
        throw error
    }
}

/**
 * @description Function to retrieve an interview report based on the provided interviewId. It sends a GET request to the backend API and returns the report data.
 */


export const  getInterviewReportById = async (interviewId) => {

    const response = await api.get(`/api/interview/report/${interviewId}`)
    return response.data
}

/**
 * @description Function to retrieve all interview reports of the user. It sends a GET request to the backend API and returns the list of reports.
 */
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview")
    return response.data
}

/**
 * @description Fetches the tailored resume PDF for a report. POST, not GET —
 * the first call for a report has side effects on the backend (a Gemini call
 * and a DB write), so it isn't safe/idempotent the way a plain GET should be.
 * Returns the raw blob + filename only; triggering the actual browser
 * download is a DOM side effect that belongs in the hook layer, not here.
 */
export const fetchTailoredResume = async (interviewId) => {
    return fetchTailoredResumeFile(`/api/interview/report/${interviewId}/resume`, "Resume.pdf")
}

/**
 * @description Fetches the tailored resume's LaTeX (.tex) source for a report,
 * for users who want to edit or compile it themselves. Same POST-for-side-effects
 * and blob-error-unwrapping reasoning as fetchTailoredResume above.
 */
export const fetchTailoredResumeLatex = async (interviewId) => {
    return fetchTailoredResumeFile(`/api/interview/report/${interviewId}/resume/latex`, "Resume.tex")
}

async function fetchTailoredResumeFile(url, defaultFilename) {
    let response
    try {
        response = await api.post(url, null, {
            responseType: "blob"
        })
    } catch (error) {
        // responseType: "blob" applies to error bodies too, so the backend's
        // JSON { message } comes back as a Blob instead of parsed JSON here —
        // read it back out so callers get a real error message, not [object Blob].
        if (error.response?.data instanceof Blob) {
            const text = await error.response.data.text()
            try {
                throw new Error(JSON.parse(text).message || error.message, { cause: error })
            } catch (parseError) {
                if (parseError instanceof Error && parseError.cause === error) {
                    throw parseError
                }
                // body wasn't JSON either — fall through to the original axios error
            }
        }
        throw error
    }

    const disposition = response.headers["content-disposition"] || ""
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
    const filename = filenameMatch ? filenameMatch[1] : defaultFilename

    return { blob: response.data, filename }
}

