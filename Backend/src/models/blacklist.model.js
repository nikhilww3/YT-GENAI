const mongoose = require('mongoose')


// for production we use redix for blacklist the token but we making only for project base that why we used mangoDB
const blacklistTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [ true, "token is required to added in blacklist"]
    }
},{
    timestamps: true 
})

const tokenBlacklistModel = mongoose.model("blacklistTokens", blacklistTokenSchema)

module.exports = tokenBlacklistModel 