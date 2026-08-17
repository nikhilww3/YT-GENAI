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

    const generateReport = useCallback(async ({jobDescription, selfDescription, resumeFile}) => {
        setLoading(true)
        try {
            const response = await generateInterviewReport({jobDescription, selfDescription, resumeFile})
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.error("Error generating interview report:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [setLoading, setReport])


    const getReportById = useCallback(async (id) => {
        setLoading(true)
        try {
            const response = await getInterviewReportById(id)
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.error("Error fetching interview report by ID:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [setLoading, setReport])

    const getReports = useCallback(async () => {
        setLoading(true)
        try {
            const response = await getAllInterviewReports()
            setReports(response.interviewReports)
            return response.interviewReports
        } catch (error) {
            console.error("Error fetching interview reports:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [setLoading, setReports])

    // Takes interviewId explicitly (like getReportById) rather than closing
    // over the route param — useInterview() is also called from Home.jsx,
    // which has no :interviewId, so an implicit version would silently break
    // if a download action were ever added there.
    const downloadResume = useCallback(async (id) => {
        setDownloadingResume(true)
        try {
            const { blob, filename } = await fetchTailoredResume(id)
            downloadBlob(blob, filename)
        } catch (error) {
            console.error("Error downloading tailored resume:", error)
            throw error
        } finally {
            setDownloadingResume(false)
        }
    }, [])

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [interviewId, getReportById, getReports])


    return {
        loading,
        report,
        reports,
        generateReport,
        getReportById,
        getReports,
        downloadResume,
        downloadingResume
    }

}
