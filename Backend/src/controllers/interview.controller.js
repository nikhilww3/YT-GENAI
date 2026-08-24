const { PDFParse } = require("pdf-parse")
const generateInterviewReport = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { generateTailoredResumeContent, renderResumeTemplate, getOrCompileTailoredResumePdf, isValidTailoredResume, extractResumeText, assertSafeLatex, parseLatexError, compileLatexToPdf } = require("../services/resume.service")
const { runMechanicalChecks } = require("../services/atsChecks.service")
const { analyseResumeAgainstJob } = require("../services/atsAnalysis.service")
const { suggestResumeImprovements } = require("../services/atsSuggestions.service")



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
    const { selfDescription, jobDescription } = req.body

    if (!jobDescription?.trim()) {
      return res.status(400).json({ message: "Job description is required" })
    }

    /* The resume and the self description are alternatives: the report needs
       something about the candidate, but either source will do. Only the absence
       of both is a bad request. */
    if (!req.file && !selfDescription?.trim()) {
      return res.status(400).json({
        message: "Attach a resume or describe yourself — one of the two is needed"
      })
    }

    let providers
    try {
      providers = parseRequestedProviders(req.body.providers)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }

    /* Parsed only when papers were actually attached. Stays "" otherwise, so the
       prompt builder and the stored report both see an absent resume rather than
       a parse of nothing. */
    let resumeText = ""
    if (req.file) {
      const parser = new PDFParse({ data: Uint8Array.from(req.file.buffer) })
      const resumeContent = await parser.getText()
      await parser.destroy() // frees memory, recommended by pdf-parse docs
      resumeText = resumeContent.text
    }

    const outcomes = await Promise.allSettled(providers.map(async (provider) => {
      const interviewReportByAi = await generateInterviewReport({
        resume: resumeText,
        selfDescription,
        jobDescription,
        provider
      })

      const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeText,
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
/*
 * The ATS work needs the report itself as well as the resume — the job
 * description to analyse against, and the stored matchScore to show a delta
 * from. Kept as one lookup so the ownership and "no uploaded resume" guards
 * cannot drift apart from the download path's copy.
 */
async function loadReportWithTailoredResume(interviewId, userId) {
  const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: userId })

  if (!interviewReport) {
    throw Object.assign(new Error("Interview report not found"), { status: 404 })
  }

  if (!interviewReport.resume) {
    throw Object.assign(new Error("A tailored resume requires an uploaded resume — this report was generated from a self-description only"), { status: 400 })
  }

  const generated = await getOrGenerateTailoredResume(interviewReport)

  /* Everything downstream — the parser view, the score, both downloads — reads
     the working copy when one exists. Resolved in exactly one place so a new
     reader cannot accidentally render the pre-edit resume and leave the user
     looking at changes that appear not to have applied. */
  const tailoredResume = interviewReport.resumeDraft || generated

  return { interviewReport, tailoredResume, generated }
}

/*
 * The single answer to "what LaTeX is this resume, right now".
 *
 * Hand-edited source wins outright: once someone has taken the document over,
 * re-rendering it from the structured content would silently discard their work.
 * Resolved here rather than at each call site so no reader can disagree about
 * which version it is looking at.
 */
async function resolveTexSource(interviewReport, tailoredResume) {
  return interviewReport.resumeTex || renderResumeTemplate(tailoredResume.toObject())
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
    const { interviewReport, tailoredResume } = await loadReportWithTailoredResume(interviewId, req.user.id)

    const texSource = await resolveTexSource(interviewReport, tailoredResume)
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
    const { interviewReport, tailoredResume } = await loadReportWithTailoredResume(interviewId, req.user.id)
    const texSource = await resolveTexSource(interviewReport, tailoredResume)

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

/**
 * @description Returns the tailored resume's text exactly as a PDF parser reads
 * it — the "what the parser sees" view. Reuses the same content resolution and
 * compile cache as the downloads, so opening this costs no extra Tectonic run
 * when the resume has already been compiled.
 * @route POST /api/interview/report/:interviewId/resume/parser-view
 * @access Private
 */
async function resumeParserViewController(req, res) {
  const { interviewId } = req.params

  try {
    const { interviewReport, tailoredResume } = await loadReportWithTailoredResume(interviewId, req.user.id)
    const content = tailoredResume.toObject()
    const texSource = await resolveTexSource(interviewReport, tailoredResume)
    const pdfBuffer = await getOrCompileTailoredResumePdf(interviewId, texSource)
    const text = await extractResumeText(pdfBuffer)
    const checks = runMechanicalChecks(text, content)

    /* `content` goes to the client so applying a suggestion is a local edit to a
       document it already holds, then one save — rather than a round trip to ask
       the server what the resume currently says. `edited` tells the UI whether
       "restore the generated resume" has anything to restore. */
    res.status(200).json({
      name: tailoredResume.name,
      text,
      checks,
      content,
      // Already rendered above to compile the PDF, so the source pane costs
      // nothing extra — sending it here saves the workbench a second request.
      tex: texSource,
      edited: Boolean(interviewReport.resumeDraft),
      // Distinct from `edited`: that means the structured content was changed,
      // this means the LaTeX itself was taken over. They revert separately.
      texEdited: Boolean(interviewReport.resumeTex),
    })
  } catch (error) {
    console.error("resumeParserViewController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to read the resume's text layer", error: error.message })
  }
}

/**
 * @description Scores the tailored resume against this report's job description
 * and classifies the posting's priority keywords by how they appear in the
 * resume. The score is a PREVIEW: it is never written back to the report, whose
 * own matchScore is a record of what was generated at that time. Both numbers
 * are returned so the UI can show the movement rather than a bare figure.
 * @route POST /api/interview/report/:interviewId/resume/ats
 * @access Private
 */
async function resumeAtsAnalysisController(req, res) {
  const { interviewId } = req.params

  try {
    const { interviewReport, tailoredResume } = await loadReportWithTailoredResume(interviewId, req.user.id)

    const texSource = await resolveTexSource(interviewReport, tailoredResume)
    const pdfBuffer = await getOrCompileTailoredResumePdf(interviewId, texSource)
    const resumeText = await extractResumeText(pdfBuffer)

    const analysis = await analyseResumeAgainstJob({
      resumeText,
      jobDescription: interviewReport.jobDescription
    })

    /* Sequential, not parallel: the suggestions are targeted at the gaps the
       analysis just found, so they need its keyword classification as input. */
    const advice = await suggestResumeImprovements({
      tailoredResume: tailoredResume.toObject(),
      sourceResume: interviewReport.resume,
      selfDescription: interviewReport.selfDescription,
      jobDescription: interviewReport.jobDescription,
      keywords: analysis.keywords
    })

    res.status(200).json({
      score: analysis.score,
      baseline: typeof interviewReport.matchScore === "number" ? interviewReport.matchScore : null,
      keywords: analysis.keywords,
      suggestions: advice.suggestions,
      untrueSkills: advice.untrueSkills
    })
  } catch (error) {
    console.error("resumeAtsAnalysisController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to analyse the resume against the posting", error: error.message })
  }
}

/**
 * @description Compiles hand-edited LaTeX and, on success, makes it the resume's
 * authoritative source. Two guards run before Tectonic sees anything: the
 * primitive blocklist, and Tectonic's own --untrusted mode inside compileLatexToPdf.
 *
 * Saved only when the compile succeeds, so the stored source is always a document
 * that actually builds — a failed attempt leaves the last working version in place
 * and the user keeps their preview.
 *
 * Deliberately bypasses getOrCompileTailoredResumePdf: the whole point of an editor
 * is that the source keeps changing, so cache hits would be rare, and every miss
 * would push another full PDF buffer into a 50-entry LRU that outlives the session.
 * @route POST /api/interview/report/:interviewId/resume/compile
 * @access Private
 */
async function compileResumeLatexController(req, res) {
  const { interviewId } = req.params
  const { tex } = req.body

  try {
    if (typeof tex !== "string" || tex.trim().length === 0) {
      return res.status(400).json({ message: "No LaTeX source was provided" })
    }

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
    if (!interviewReport) {
      return res.status(404).json({ message: "Interview report not found" })
    }

    assertSafeLatex(tex)

    let pdfBuffer
    try {
      pdfBuffer = await compileLatexToPdf(tex)
    } catch (compileError) {
      /* 422, not 500: the server is fine, the document does not build. The
         located error goes back so the editor can mark the failing line rather
         than showing the user a wall of TeX log. */
      const failure = parseLatexError(compileError.latexLog)
      return res.status(422).json({
        message: "The document did not compile",
        error: failure
      })
    }

    interviewReport.resumeTex = tex
    await interviewReport.save()

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"resume-preview.pdf\""
    })
    res.send(pdfBuffer)
  } catch (error) {
    console.error("compileResumeLatexController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to compile the resume", error: error.message })
  }
}

/**
 * @description Discards hand-edited LaTeX, returning the resume to being rendered
 * from its structured content. The counterpart to taking the document over.
 * @route DELETE /api/interview/report/:interviewId/resume/tex
 * @access Private
 */
async function discardResumeTexController(req, res) {
  const { interviewId } = req.params

  try {
    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
    if (!interviewReport) {
      return res.status(404).json({ message: "Interview report not found" })
    }

    interviewReport.resumeTex = undefined
    await interviewReport.save()

    res.status(200).json({ message: "Reverted to the generated LaTeX" })
  } catch (error) {
    console.error("discardResumeTexController error:", error)
    res.status(500).json({ message: "Failed to revert the LaTeX source", error: error.message })
  }
}

/**
 * @description Streams the compiled resume for on-screen preview. Same bytes as
 * the download, but served inline and under the workbench's own rate limit —
 * previewing repeatedly while editing must not consume the download budget.
 * @route POST /api/interview/report/:interviewId/resume/preview
 * @access Private
 */
async function resumePreviewController(req, res) {
  const { interviewId } = req.params

  try {
    const { interviewReport, tailoredResume } = await loadReportWithTailoredResume(interviewId, req.user.id)
    const texSource = await resolveTexSource(interviewReport, tailoredResume)
    const pdfBuffer = await getOrCompileTailoredResumePdf(interviewId, texSource)

    res.set({
      "Content-Type": "application/pdf",
      // inline, not attachment: this one is meant to render in the page
      "Content-Disposition": "inline; filename=\"resume-preview.pdf\""
    })
    res.send(pdfBuffer)
  } catch (error) {
    console.error("resumePreviewController error:", error)
    res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to render the resume preview", error: error.message })
  }
}

/**
 * @description Saves the user's working copy of the tailored resume. The whole
 * document is sent, not a patch: applying a suggestion, undoing one, and redoing
 * one are all just "the resume now looks like this", so a single setter covers
 * every case and the undo stack is plain snapshots on the client.
 *
 * Validated before it is stored — this is the user's own content and carries no
 * privilege, but a malformed body would break rendering for every later read.
 * @route PUT /api/interview/report/:interviewId/resume/draft
 * @access Private
 */
async function saveResumeDraftController(req, res) {
  const { interviewId } = req.params
  const { content } = req.body

  try {
    if (!isValidTailoredResume(content)) {
      return res.status(400).json({ message: "That resume content does not match the expected shape" })
    }

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
    if (!interviewReport) {
      return res.status(404).json({ message: "Interview report not found" })
    }

    interviewReport.resumeDraft = content
    await interviewReport.save()

    res.status(200).json({ content: interviewReport.resumeDraft })
  } catch (error) {
    console.error("saveResumeDraftController error:", error)
    res.status(500).json({ message: "Failed to save your changes", error: error.message })
  }
}

/**
 * @description Discards the working copy, returning the resume to what was
 * originally generated. The generated content itself is never touched, so this
 * is always available however many changes were applied.
 * @route DELETE /api/interview/report/:interviewId/resume/draft
 * @access Private
 */
async function discardResumeDraftController(req, res) {
  const { interviewId } = req.params

  try {
    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
    if (!interviewReport) {
      return res.status(404).json({ message: "Interview report not found" })
    }

    interviewReport.resumeDraft = undefined
    await interviewReport.save()

    res.status(200).json({ content: interviewReport.tailoredResume })
  } catch (error) {
    console.error("discardResumeDraftController error:", error)
    res.status(500).json({ message: "Failed to restore the generated resume", error: error.message })
  }
}

module.exports = { generateInterviewReportController, getInterviewReportController, getAllInterviewReportsController, downloadTailoredResumeController, downloadTailoredResumeLatexController, resumeParserViewController, resumeAtsAnalysisController, saveResumeDraftController, discardResumeDraftController, resumePreviewController, compileResumeLatexController, discardResumeTexController }