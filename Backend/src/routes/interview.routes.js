const express = require("express")
const { rateLimit, ipKeyGenerator } = require("express-rate-limit")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()

// Each hit spawns a Gemini call and/or a CPU-heavy Tectonic compile — cap it
// per user (not per IP) so this can't be used to exhaust server resources.
const tailoredResumeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many resume requests, please try again in a few minutes" }
})

/* Deliberately separate from tailoredResumeLimiter. The workbench calls this on
   open and on every change, so sharing that 10-per-5-minutes budget would let an
   editing session lock the user out of downloading the resume they just improved. */
const resumeWorkbenchLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many resume workbench requests, please try again in a few minutes" }
})

/**
 * @route POST /api/intervirew/
 * @description generate new interview report on the basis of user itself description, resume pdf and job description
 * @access private
 */

interviewRouter.post("/", authMiddleware.authUser, upload.single("resume"), interviewController.generateInterviewReportController)
/**
 * @route Get /api/interview/report/:interviewId
 * @description get interview report on the basis of interviewId
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportController)

/**
 * @route POST /api/interview/report/:interviewId/resume
 * @description generate (or reuse) a tailored resume PDF for this report and download it.
 * POST, not GET, because the first call has side effects (a Gemini call + a DB
 * write) — a GET here would be triggerable by link-preview crawlers, prefetch,
 * or a same-site auto-navigating page, none of which should burn a paid API call.
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume", authMiddleware.authUser, tailoredResumeLimiter, interviewController.downloadTailoredResumeController)

/**
 * @route POST /api/interview/report/:interviewId/resume/latex
 * @description generate (or reuse) the tailored resume's LaTeX source and download it as a .tex file.
 * Same POST-not-GET reasoning as the PDF route above, and shares its rate limiter
 * since both can trigger the same Gemini call.
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume/latex", authMiddleware.authUser, tailoredResumeLimiter, interviewController.downloadTailoredResumeLatexController)

/**
 * @route POST /api/interview/report/:interviewId/resume/parser-view
 * @description return the tailored resume's text layer as a PDF parser reads it
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume/parser-view", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.resumeParserViewController)

/**
 * @route POST /api/interview/report/:interviewId/resume/ats
 * @description score the tailored resume against the posting and classify its priority keywords
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume/ats", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.resumeAtsAnalysisController)

/**
 * @route POST /api/interview/report/:interviewId/resume/preview
 * @description stream the compiled resume inline for on-screen preview
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume/preview", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.resumePreviewController)

/**
 * @route POST /api/interview/report/:interviewId/resume/compile
 * @description compile hand-edited LaTeX and, on success, adopt it as the source
 * @access private
 */
interviewRouter.post("/report/:interviewId/resume/compile", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.compileResumeLatexController)

/**
 * @route DELETE /api/interview/report/:interviewId/resume/tex
 * @description discard hand-edited LaTeX and render from structured content again
 * @access private
 */
interviewRouter.delete("/report/:interviewId/resume/tex", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.discardResumeTexController)

/**
 * @route PUT /api/interview/report/:interviewId/resume/draft
 * @description save the user's working copy of the tailored resume
 * @access private
 */
interviewRouter.put("/report/:interviewId/resume/draft", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.saveResumeDraftController)

/**
 * @route DELETE /api/interview/report/:interviewId/resume/draft
 * @description discard the working copy and return to the generated resume
 * @access private
 */
interviewRouter.delete("/report/:interviewId/resume/draft", authMiddleware.authUser, resumeWorkbenchLimiter, interviewController.discardResumeDraftController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of the user
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)
 

module.exports = interviewRouter