import {getAllInterviewReports, generateInterviewReport, getInterviewReportById} from "../services/interview.api"
import {useContext, useEffect } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"

/**
 * @description Custom hook to manage interview-related state and actions. It provides functions to generate an interview report, retrieve a specific report by ID, and fetch all reports for the user. It also manages loading and error states.
 */

export const useInterview = () => {

    const context = useContext(InterviewContext)

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const {loading, setLoading, report, setReport, reports, setReports} = context

    const generateReport = async ({jobDescription, selfDescription, resumeFile}) => {
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
    }


    const getReportById = async (interviewId) => {
        setLoading(true)
        try {
            const response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.error("Error fetching interview report by ID:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const getReports = async () => {
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
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [interviewId])


    return {
        loading,
        report,
        reports,
        generateReport,
        getReportById,
        getReports
    }

}
