const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

async function authUser(req, res, next){

    const token = req.cookies.token

    if(!token){
        return res.status(401).json({
            message: "token not provided"
        })
    }

    /* we check the token is not in blacklist */
    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token
    })

    if(isTokenBlacklisted){
        return res.status(401).json({
            message: "token is invaild"
        })
    }

    /* we use try and catch because if token is not verify or expriry then it return error */
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        // if the condition of middleware satisfy then we move next middleware or route api
        next()
    } catch (err) {
        return res.status(401).json({
            message: "Invaild token"
        })
    }

}

module.exports = {
    authUser,
}