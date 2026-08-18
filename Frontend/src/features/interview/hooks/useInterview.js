import {getAllInterviewReports, generateInterviewReport, getInterviewReportById, fetchTailoredResume} from "../services/interview.api"
import {useCallback, useContext, useEffect, useState } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"
import { downloadBlob } from "../../../lib/downloadBlob"

/**
 * @description Custom hook to manage interview-related state and actions. It provides functions to generate an interview report, retrieve a specific report by ID, and fetch all reports for the user. It also manages loading and error states.
 */

export const useInterview = () => {

    const context = useContext(InterviewContext)

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const {loading, setLoading, report, setReport, reports, setReports} = context
    const { interviewId } = useParams()
    // Separate from `loading` on purpose — that one drives a full-page
    // takeover, but a resume download is a single button's own spinner and
    // shouldn't block the rest of the report from being visible/usable.
    const [downloadingResume, setDownloadingResume] = useState(false)
    // Page-level failure (e.g. the report list couldn't load) — rendered as a
    // full error screen with a retry, distinct from generationSummary below
    // which reports the outcome of one generation attempt.
    const [error, setError] = useState(null)
    // Per-provider outcome of the most recent generate, in the same shape the
    // backend returns. Also settable by callers for client-side validation
    // errors, so the UI has exactly one place to render "what just happened".
    const [generationSummary, setGenerationSummary] = useState([])

    const fetchReports = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await getAllInterviewReports()
            setReports(response.interviewReports)
            return response.interviewReports
        } catch (err) {
            // A user with no reports yet gets a 404 from the list endpoint —
            // that's an empty state, not an error worth blocking the page for.
            if (err.response?.status === 404) {
                setReports([])
                return []
            }
            console.error("Error fetching interview reports:", err)
            setError("We couldn't load your reports. Please try again.")
            return []
        } finally {
            setLoading(false)
        }
    }, [setLoading, setReports])

    // Generates a report with the single selected provider. The backend takes
    // a providers[] array (it can generate several at once), so the one
    // choice is wrapped here rather than leaking that shape into the UI.
    const generateReport = useCallback(async ({jobDescription, selfDescription, resumeFile, providerId}) => {
        setLoading(true)
        try {
            const response = await generateInterviewReport({
                jobDescription,
                selfDescription,
                resumeFile,
                providers: [providerId]
            })

            // Normalize for rendering: the backend's success results carry the
            // whole interviewReport object and no message, so flatten out the
            // id and supply copy the UI can show directly.
            const results = (response.results ?? []).map((result) =>
                result.status === "success"
                    ? {
                        ...result,
                        reportId: result.interviewReport?._id,
                        message: "Report generated successfully."
                    }
                    : result
            )

            setGenerationSummary(results)
            await fetchReports()
            return results
        } catch (err) {
            console.error("Error generating interview report:", err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [setLoading, fetchReports])


    const getReportById = useCallback(async (id) => {
        setLoading(true)
        setError(null)
        try {
            const response = await getInterviewReportById(id)
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (err) {
            console.error("Error fetching interview report by ID:", err)
            setError("We couldn't load this report. Please try again.")
            return null
        } finally {
            setLoading(false)
        }
    }, [setLoading, setReport])

    // Takes interviewId explicitly (like getReportById) rather than closing
    // over the route param — useInterview() is also called from Home.jsx,
    // which has no :interviewId, so an implicit version would silently break
    // if a download action were ever added there.
    const downloadResume = useCallback(async (id) => {
        setDownloadingResume(true)
        try {
            const { blob, filename } = await fetchTailoredResume(id)
            downloadBlob(blob, filename)
        } catch (err) {
            console.error("Error downloading tailored resume:", err)
            throw err
        } finally {
            setDownloadingResume(false)
        }
    }, [])

    // Only the detail page auto-fetches here — Home calls fetchReports()
    // itself, so auto-fetching the list too would double-request on mount.
    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [interviewId, getReportById])


    return {
        loading,
        error,
        report,
        reports,
        generationSummary,
        setGenerationSummary,
        generateReport,
        getReportById,
        fetchReports,
        downloadResume,
        downloadingResume
    }

}
