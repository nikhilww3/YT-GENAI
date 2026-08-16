
require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")



connectToDB()


// this call app to local server on 3000 port
app.listen(3000, ()=>{
    console.log("Server is running on port 3000")
}) 