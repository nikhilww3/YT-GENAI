const { PDFParse } = require("pdf-parse")
const generateInterviewReport = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { generateTailoredResumeContent, renderResumeTemplate, getOrCompileTailoredResumePdf, isValidTailoredResume } = require("../services/resume.service")



const KNOWN_PROVIDERS = generateInterviewReport.PROVIDERS
const DEFAULT_PROVIDERS = ["gemini"]

function parseRequestedProviders(rawProviders) {
  if (!rawProviders) {
    return DEFAULT_PROVIDERS
  }

  let providers
  try {
    providers = typeof rawProviders === "string" ? JSON.parse(rawProviders) : rawProviders
  } catch {
    throw new Error("providers must be a JSON array of provider ids")
  }

  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error("providers must be a non-empty array")
  }

  const unknown = providers.filter(p => !KNOWN_PROVIDERS[p])
  if (unknown.length > 0) {
    throw new Error(`Unknown provider(s): ${unknown.join(", ")}`)
  }

  return providers
}

/**
@description Controller to generate one interview report per requested AI provider, from the
same resume PDF/self-description/job description. Each provider succeeds or fails independently
— one provider failing (bad/missing key, rate limit, malformed output) never blocks the others,
and there is no silent fallback between providers.
@route POST /api/interview/
@access Private
 */

async function generateInterviewReportController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" })
    }

    let providers
    try {
      providers = parseRequestedProviders(req.body.providers)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }

    const parser = new PDFParse({ data: Uint8Array.from(req.file.buffer) })
    const resumeContent = await parser.getText()
    await parser.destroy() // frees memory, recommended by pdf-parse docs

    const { selfDescription, jobDescription } = req.body

    const outcomes = await Promise.allSettled(providers.map(async (provider) => {
      const interviewReportByAi = await generateInterviewReport({
        resume: resumeContent.text,
        selfDescription,
        jobDescription,
        provider
      })

      const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeContent.text,
        selfDescription,
        jobDescription,
        provider,
        title: `${interviewReportByAi.title} (${KNOWN_PROVIDERS[provider].label})`,
        matchScore: interviewReportByAi.matchscore,
        technicalQuestion: interviewReportByAi.technicalQuestions,
        behavioralQuestion: interviewReportByAi.behavioralQuestions,
        skillGap: interviewReportByAi.skillsGap,
        preparationPlan: interviewReportByAi.preparationPlan
      })

      return interviewReport
    }))

    const results = outcomes.map((outcome, i) => {
      const provider = providers[i]
      const providerLabel = KNOWN_PROVIDERS[provider].label

      if (outcome.status === "fulfilled") {
        return { provider, providerLabel, status: "success", interviewReport: outcome.value }
      }

      console.error(`generateInterviewReportController error (${provider}):`, outcome.reason)
      return { provider, providerLabel, status: "error", message: outcome.reason.message }
    })

    const anySucceeded = results.some(r => r.status === "success")

    res.status(anySucceeded ? 201 : 502).json({
      message: anySucceeded ? "Interview report generation finished" : "All providers failed to generate a report",
      results
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

    // NOT .finally() — .finally() returns a new promise that re-rejects with
    // the same reason when `generation` rejects, and since nothing attaches
    // a handler to THAT derived promise (it's a bare statement, never
    // stored/awaited), Node flags it as an unhandled rejection and crashes
    // the whole process — even though `generation` itself is properly
    // awaited and caught by the controller below. Verified live: a Gemini
    // timeout during resume generation took the entire server down this way.
    // .then(cleanup, cleanup) cleans up on both outcomes without ever
    // producing a promise that rejects.
    const cleanup = () => inFlightResumeGenerations.delete(interviewId)
    generation.then(cleanup, cleanup)
    inFlightResumeGenerations.set(interviewId, generation)
  }

  return inFlightResumeGenerations.get(interviewId)
}

/**
 * Shared by both download endpoints below: finds the report, checks it has a
 * resume, and returns the (cached-or-generated) tailored resume content.
 * Throws a { status, message } error the callers turn into the right HTTP
 * response, so the 404/400 checks aren't duplicated between them.
 */
async function loadTailoredResumeForDownload(interviewId, userId) {
  const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: userId })

  if (!interviewReport) {
    throw Object.assign(new Error("Interview report not found"), { status: 404 })
  }

  if (!interviewReport.resume) {
    throw Object.assign(new Error("A tailored resume requires an uploaded resume — this report was generated from a self-description only"), { status: 400 })
  }

  return getOrGenerateTailoredResume(interviewReport)
}

/**
 * @description Controller to generate (once, then reuse) a tailored resume PDF for
 * a report and stream it straight back as a download. Never touches server disk
 * or the database with the compiled PDF — only the AI-generated content behind
 * it is persisted; the compiled PDF itself is cached in-memory by
 * getOrCompileTailoredResumePdf so repeat downloads of the same content skip
 * both the Gemini call and the Tectonic compile.
 * @route POST /api/interview/report/:interviewId/resume
 * @access Private
 */
async function downloadTailoredResumeController(req, res) {
  const { interviewId } = req.params

  try {
    const tailoredResume = await loadTailoredResumeForDownload(interviewId, req.user.id)

    const texSource = await renderResumeTemplate(tailoredResume.toObject())
    const pdfBuffer = await getOrCompileTailoredResumePdf(interviewId, texSource)

    const safeName = tailoredResume.name.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Resume"

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}_Resume.pdf"`
    })
    res.send(pdfBuffer)
  } catch (error) {
    console.error("downloadTailoredResumeController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to generate tailored resume", error: error.message })
  }
}

/**
 * @description Controller to download the rendered LaTeX (.tex) source behind
 * the tailored resume, for users who want to edit/compile it themselves.
 * Reuses the same cached AI content as the PDF download; skips
 * compileLatexToPdf entirely since a plain-text download needs no Tectonic
 * run at all.
 * @route POST /api/interview/report/:interviewId/resume/latex
 * @access Private
 */
async function downloadTailoredResumeLatexController(req, res) {
  const { interviewId } = req.params

  try {
    const tailoredResume = await loadTailoredResumeForDownload(interviewId, req.user.id)
    const texSource = await renderResumeTemplate(tailoredResume.toObject())

    const safeName = tailoredResume.name.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Resume"

    res.set({
      "Content-Type": "application/x-tex; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}_Resume.tex"`
    })
    res.send(texSource)
  } catch (error) {
    console.error("downloadTailoredResumeLatexController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to generate resume LaTeX source", error: error.message })
  }
}

module.exports = { generateInterviewReportController, getInterviewReportController, getAllInterviewReportsController, downloadTailoredResumeController, downloadTailoredResumeLatexController }