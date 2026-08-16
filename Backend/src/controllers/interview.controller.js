const { PDFParse } = require("pdf-parse")
const generateInterviewReport = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")



/**
@description Controller to generate an interview report based on the user's self-description, resume PDF, and job description. It extracts text from the uploaded resume file, calls the AI service to generate the report, and saves it to the database.
@route POST /api/interview/
@access Private
 */

async function generateInterviewReportController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" })
    }

    const parser = new PDFParse({ data: Uint8Array.from(req.file.buffer) })
    const resumeContent = await parser.getText()
    await parser.destroy() // frees memory, recommended by pdf-parse docs

    const { selfDescription, jobDescription } = req.body

    const interviewReportByAi = await generateInterviewReport({
      resume: resumeContent.text,
      selfDescription,
      jobDescription
    })

    const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeContent.text,
        selfDescription,
        jobDescription,
        title: interviewReportByAi.title,
        matchScore: interviewReportByAi.matchscore,
        technicalQuestion: interviewReportByAi.technicalQuestions,
        behavioralQuestion: interviewReportByAi.behavioralQuestions,
        skillGap: interviewReportByAi.skillsGap,
        preparationPlan: interviewReportByAi.preparationPlan
    })

    res.status(201).json({
      message: "Interview report generated successfully",
      interviewReport
    })
  } catch (error) {
    console.error("generateInterviewReportController error:", error)
    res.status(500).json({ message: "Failed to generate interview report", error: error.message })
  }
}

/**
 * @description Controller to retrieve an interview report based on the provided interviewId. It fetches the report from the database and returns it to the client.
 * @route GET /api/interview/report/:interviewId
 * @access Private
 */

async function getInterviewReportController(req, res) {

  const { interviewId } = req.params

  const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

  if (!interviewReport) {
    return res.status(404).json({ message: "Interview report not found" })
  }

  res.status(200).json({
    message: "Interview report retrieved successfully",
    interviewReport
  })

}


/**
 * @description Controller to retrieve all interview reports for the authenticated user. It fetches the reports from the database and returns them to the client.
 * @route GET /api/interview/
 * @access Private
 */
async function getAllInterviewReportsController(req, res) {

  const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestion -behavioralQuestion -skillGap -preparationPlan") // Exclude large text fields for efficiency

  if (!interviewReports || interviewReports.length === 0) {
    return res.status(404).json({ message: "No interview reports found" })
  }


  res.status(200).json({
    message: "All interview reports retrieved successfully",
    interviewReports
  })

}



module.exports = { generateInterviewReportController, getInterviewReportController, getAllInterviewReportsController }