const mongoose = require("mongoose")

// this is a function to connect database
async function connectToDB(){
    try{
        await mongoose.connect(process.env.MONGO_URL)
        console.log("Connect to Database")
    }
    catch(err){
        console.log(err)
    }
}

// this module.exports send out a file to use someone who require
module.exports = connectToDB