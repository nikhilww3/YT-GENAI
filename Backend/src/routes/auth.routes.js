const express = require("express")
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")

/* Router is used to organize and handle routes in a modular way. */
const authRouter = express.Router()

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


module.exports = authRouter