const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()

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
 * @route GET /api/interview/
 * @description get all interview reports of the user
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)
 

module.exports = interviewRouter