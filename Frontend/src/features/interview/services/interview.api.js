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

/**
 * @description Returns the tailored resume's text layer exactly as a PDF parser
 * reads it — { name, text }. POST for the same reason as the downloads: the first
 * call for a report can generate content and compile, so it isn't idempotent.
 * Errors propagate so the workbench can show the real backend reason.
 */
export const fetchResumeParserView = async (interviewId) => {
    const response = await api.post(`/api/interview/report/${interviewId}/resume/parser-view`)
    return response.data
}

/**
 * @description Scores the tailored resume against the report's job description and
 * classifies the posting's priority requirements — { score, baseline, keywords }.
 * `baseline` is the report's own stored matchScore and may be null; the live score
 * is a preview and never replaces it.
 */
export const fetchResumeAtsAnalysis = async (interviewId) => {
    const response = await api.post(`/api/interview/report/${interviewId}/resume/ats`)
    return response.data
}

/**
 * @description Fetches the compiled resume as a Blob for on-screen preview. The
 * caller owns the object URL and must revoke it — see useResumePreview.
 */
export const fetchResumePreview = async (interviewId) => {
    const response = await api.post(`/api/interview/report/${interviewId}/resume/preview`, null, {
        responseType: "blob"
    })
    return response.data
}

/**
 * @description Compiles hand-edited LaTeX. Resolves with a PDF Blob on success.
 * On a compile failure the backend answers 422 with a located error, which is
 * rethrown as { line, message } so the editor can mark the failing line.
 */
export const compileResumeLatex = async (interviewId, tex) => {
    try {
        const response = await api.post(
            `/api/interview/report/${interviewId}/resume/compile`,
            { tex },
            { responseType: "blob" }
        )
        return response.data
    } catch (error) {
        // responseType "blob" applies to error bodies too, so the JSON the server
        // sent arrives as a Blob and has to be read back out to be useful.
        if (error.response?.data instanceof Blob) {
            const text = await error.response.data.text()
            try {
                const body = JSON.parse(text)
                throw Object.assign(new Error(body.message || "The document did not compile"), {
                    latex: body.error ?? null,
                    status: error.response.status,
                })
            } catch (parseError) {
                if (parseError.latex !== undefined) throw parseError
                // body wasn't JSON — fall through to the original error
            }
        }
        throw error
    }
}

/**
 * @description Discards hand-edited LaTeX so the resume renders from its
 * structured content again.
 */
export const discardResumeTex = async (interviewId) => {
    const response = await api.delete(`/api/interview/report/${interviewId}/resume/tex`)
    return response.data
}

/**
 * @description Saves the whole working copy of the tailored resume. The full
 * document is sent rather than a patch because apply, undo and redo are all just
 * "the resume now looks like this", which keeps undo a plain stack of snapshots.
 */
export const saveResumeDraft = async (interviewId, content) => {
    const response = await api.put(`/api/interview/report/${interviewId}/resume/draft`, { content })
    return response.data
}

/**
 * @description Discards the working copy, returning to the generated resume. The
 * generated content is never overwritten, so this always has something to restore.
 */
export const discardResumeDraft = async (interviewId) => {
    const response = await api.delete(`/api/interview/report/${interviewId}/resume/draft`)
    return response.data
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

