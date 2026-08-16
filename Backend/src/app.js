// require is import the module for another file
const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

// this is call the express in app varibles
const app = express()

app.use(express.json())
app.use(cookieParser())
// we use cors in middleware to handle cors error
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

// require all the routes here
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
//to use the all auth api we have to use a prefix to call the api
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)


module.exports = app    
