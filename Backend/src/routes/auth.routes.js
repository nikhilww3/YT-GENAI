const express = require("express")
const { rateLimit } = require("express-rate-limit")
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")

/* Router is used to organize and handle routes in a modular way. */
const authRouter = express.Router()

// Rate limiter for username availability checks to prevent enumeration
const checkUsernameLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many username checks, please try again later" }
})

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
authRouter.post("/register", authController.registerUserController)

/**
 * @route /api/auth/login
 * @description login user with email and password
 * @access public
 */

authRouter.post("/login", authController.loginUserController)

/**
 * @route Get /api/auth/logout
 * @description clear token from user cookie and add token in blacklist
 * @access publid
 */

authRouter.get("/logout", authController.logoutUserController)

/**
 * @route Get /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */

authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)

/**
 * @route GET /api/auth/check-username
 * @description check if username is available and return suggestions if taken
 * @access public
 */
authRouter.get("/check-username", checkUsernameLimiter, authController.checkUsernameController)

module.exports = authRouter