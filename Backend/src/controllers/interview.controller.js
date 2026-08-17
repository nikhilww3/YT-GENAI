const { PDFParse } = require("pdf-parse")
const generateInterviewReport = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { generateTailoredResumeContent, renderResumeTemplate, compileLatexToPdf, isValidTailoredResume } = require("../services/resume.service")



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

  const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestion -behavioralQuestion -skillGap -preparationPlan -tailoredResume") // Exclude large text fields for efficiency

  if (!interviewReports || interviewReports.length === 0) {
    return res.status(404).json({ message: "No interview reports found" })
  }


  res.status(200).json({
    message: "All interview reports retrieved successfully",
    interviewReports
  })

}



// Prevents duplicate concurrent Gemini calls for the same report — e.g. a
// double-click before the button's disabled state updates, or two open tabs.
// Keyed by interviewId; the entry is removed once the in-flight generation
// settles (success or failure) so a later request tries again cleanly.
const inFlightResumeGenerations = new Map()

async function getOrGenerateTailoredResume(interviewReport) {
  // Stored content only counts as reusable if it still matches the CURRENT
  // schema — content saved under an older version (e.g. before a field like
  // `location` was added) will otherwise silently break the template on
  // every future request for that report, forever, since nothing else would
  // ever re-generate it.
  if (interviewReport.tailoredResume && isValidTailoredResume(interviewReport.tailoredResume.toObject())) {
    return interviewReport.tailoredResume
  }

  const interviewId = interviewReport._id.toString()

  if (!inFlightResumeGenerations.has(interviewId)) {
    const generation = (async () => {
      const content = await generateTailoredResumeContent({
        resume: interviewReport.resume,
        selfDescription: interviewReport.selfDescription,
        jobDescription: interviewReport.jobDescription
      })

      // The in-flight map above already dedupes concurrent requests within
      // this process (the common case: double-click, two open tabs). A
      // cross-process race is rare enough, and both writers produce equally
      // valid content, that a plain overwrite here is an acceptable
      // trade-off for not needing to special-case "missing" vs "invalid."
      const updated = await interviewReportModel.findOneAndUpdate(
        { _id: interviewReport._id, user: interviewReport.user },
        { $set: { tailoredResume: content } },
        { returnDocument: "after" }
      )

      return updated.tailoredResume
    })()

    generation.finally(() => inFlightResumeGenerations.delete(interviewId))
    inFlightResumeGenerations.set(interviewId, generation)
  }

  return inFlightResumeGenerations.get(interviewId)
}

/**
 * @description Controller to generate (once, then reuse) a tailored resume PDF for
 * a report and stream it straight back as a download. Never touches server disk
 * or the database with the compiled PDF — only the AI-generated content behind
 * it is persisted, so a second click re-compiles from stored content instead of
 * calling Gemini again.
 * @route POST /api/interview/report/:interviewId/resume
 * @access Private
 */
async function downloadTailoredResumeController(req, res) {
  const { interviewId } = req.params

  try {
    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
      return res.status(404).json({ message: "Interview report not found" })
    }

    if (!interviewReport.resume) {
      return res.status(400).json({ message: "A tailored resume requires an uploaded resume — this report was generated from a self-description only" })
    }

    const tailoredResume = await getOrGenerateTailoredResume(interviewReport)

    const texSource = await renderResumeTemplate(tailoredResume.toObject())
    const pdfBuffer = await compileLatexToPdf(texSource)

    const safeName = tailoredResume.name.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Resume"

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}_Resume.pdf"`
    })
    res.send(pdfBuffer)
  } catch (error) {
    console.error("downloadTailoredResumeController error:", error)
    res.status(500).json({ message: "Failed to generate tailored resume", error: error.message })
  }
}

module.exports = { generateInterviewReportController, getInterviewReportController, getAllInterviewReportsController, downloadTailoredResumeController }