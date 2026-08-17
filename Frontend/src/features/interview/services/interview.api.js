import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
})


/**
 * @description Function to generate an interview report based on the user's self-description, resume PDF, and job description. It sends a POST request to the backend API with the necessary data and returns the generated report.
 */

export const generateInterviewReport = async ({jobDescription, selfDescription, resumeFile}) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    // let axios/the browser set Content-Type so the multipart boundary is included
    const response = await api.post("/api/interview", formData)

    return response.data
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
    let response
    try {
        response = await api.post(`/api/interview/report/${interviewId}/resume`, null, {
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
    const filename = filenameMatch ? filenameMatch[1] : "Resume.pdf"

    return { blob: response.data, filename }
}

