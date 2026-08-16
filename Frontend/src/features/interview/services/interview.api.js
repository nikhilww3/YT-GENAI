import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
})


/**
 * @description Function to generate an interview report based on the user's self-description, resume PDF, and job description. It sends a POST request to the backend API with the necessary data and returns the generated report.
 */

export const generateInterviewReport = async ({jobDescription, selfDescription, resume}) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    const response = await api.post("/api/interview", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    })
    
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

