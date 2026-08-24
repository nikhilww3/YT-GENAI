const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { checkPasswordStrength } = require("../services/passwordStrength.service")
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * @name registerUserController
 * @description register a new user, expect a username, email, and password
 * @access public
 */

/* this is a function to register a new user */
async function registerUserController(req, res){
    const {username, email, password} = req.body

    if(!username || !email || !password){
        return res.status(400).json({
            message: "please provide a username, email, and password"
        })
    }

    /* validate password strength */
    if(password.length < 10) {
        return res.status(400).json({
            message: "Password must be at least 10 characters long"
        })
    }

    const passwordStrength = checkPasswordStrength(password, [username, email])
    if(passwordStrength.score < 3) {
        const feedback = passwordStrength.feedback?.suggestions?.[0] || "Password is too weak"
        return res.status(400).json({
            message: `Password is too weak: ${feedback}`
        })
    }

    const isUserAlreadyExists = await userModel.findOne({
        /* $or means return the first one that matches the condition */
        $or: [{ username },{ email }]
    })

    if(isUserAlreadyExists){
        return res.status(400).json({
            message: "Account already exists with this username or email"
        })
    }

    /* hash the password */
    const hash = await bcrypt.hash(password, 10)

    /* create a new user */
    const user = await userModel.create({
        username,
        email,
        password: hash,
    })

    /* generate a token for user */
    const token = jwt.sign(
     { id: user._id, username: user.username },
     process.env.JWT_SECRET,
     { expiresIn: "1d" } /* 1 day */
    )

    res.cookie("token", token)

    res.status(201).json({
        message: "user created successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }
    })

}

/* this is a function to login a user */
/**
 * @name loginUserController
 * @description login a user, expect a email and password in request body
 * @access public
 */
async function loginUserController(req, res){

    const {email, password} = req.body

    const user = await userModel.findOne({ email })

    if(!user){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare( password, user.password )

    if(!isPasswordValid){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const token = jwt.sign(
        { id: user._id, username: user.username},
        process.env.JWT_SECRET,
        { expiresIn: "1d"}
    )
    
    res.cookie("token", token)
    res.status(200).json({
        message: "user loggedin successfully",
        user: {
            id : user._id,
            username : user.username,
            email: user.email,
        }
    })
}

/* this is a function for logout user and blacklist the token */
/**
 * @name logoutUserController
 * @description logout a user and add token in blacklist
 * @access public
 */

async function logoutUserController(req, res){
    const token = req.cookies.token
    
    if (token){
        // if the token is exist we add the token in blacklist
        await tokenBlacklistModel.create({ token })
    }

    res.clearCookie("token")

    res.status(200).json({
        message: "user logged out successfully"
    })
}

/* this is a function for get the current logged in user details */
/**
 * @name getMeController
 * @description return me cuurent loggin user details
 * @access public
 */

async function getMeController(req, res){
    // the req.user is create in middleware function and next function tranfer in next router
    const user = await userModel.findById(req.user.id)

    // the JWT itself is stateless and stays "valid" even if the account it
    // points at was deleted afterward — treat that the same as no session.
    if(!user){
        return res.status(401).json({
            message: "User not found"
        })
    }

    return res.status(200).json({
        message: "user details fetched successfully",
        user: {
            id : user._id,
            username: user.username,
            email: user.email,
        }
    })
}

/**
 * @name checkUsernameController
 * @description check if username is available and return suggestions if taken
 * @access public
 */
async function checkUsernameController(req, res) {
    try {
        const { username } = req.query

        if (!username || username.trim().length === 0) {
            return res.status(400).json({
                message: "Username is required"
            })
        }

        const normalizedUsername = username.trim()

        /* Use case-insensitive direct match instead of regex */
        const existingUser = await userModel.findOne({
            username: normalizedUsername
        }).collation({ locale: 'en', strength: 2 })

        if (!existingUser) {
            return res.status(200).json({
                available: true,
                suggestions: []
            })
        }

        /* Generate suggestions by appending numbers */
        const suggestions = []
        for (let i = 1; i <= 5; i++) {
            const suggestion = `${normalizedUsername}${i}`
            const suggestionExists = await userModel.findOne({
                username: suggestion
            }).collation({ locale: 'en', strength: 2 })
            if (!suggestionExists) {
                suggestions.push(suggestion)
            }
        }

        return res.status(200).json({
            available: false,
            suggestions
        })
    } catch (error) {
        console.error('Error checking username:', error)
        return res.status(500).json({
            message: "Error checking username availability"
        })
    }
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    checkUsernameController,
}