
require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")

// Node terminates the whole process on an unhandled promise rejection by
// default — one request hitting an unexpected error (e.g. an external API
// timeout) would otherwise take the server down for every user. Log it
// instead; the request that caused it still fails, but nothing else does.
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason)
})

connectToDB()


// this call app to local server on 3000 port
app.listen(3000, ()=>{
    console.log("Server is running on port 3000")
}) 