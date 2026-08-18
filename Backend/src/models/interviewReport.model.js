const mongoose = require("mongoose")

/**
 * - Job description schema
 * - resume text
 * - self description 
 * 
 * Overall score of your resume 
 * - MatchScore : Number
 * 
 * the AI generate schema
 * - technical questions and answer : [{
 * 
 *          question : "",
 *          intention of question : "",
 *          answer: ""
 * 
 * }] array format stored
 * - Behaviour questions : [{
 *               question : "",
 *               intention of question : "",
 *               answer: ""
 * }]
 * - Skills gap : [{
 *              skill : "",
 *              severity : {
 *              type : string
 *              enum : ["low", "medium", "High"]
 * }
 * }]
 * - preparation plan : [{
 *              day : number,
 *              focus : string,
 *              tasks : [string]
 * }] object in array for different days
 * 
 * 
 */
// Technical question schema 
const technicalQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required : [true, "Technical question is required"]
    },
    intention: {
        type: String,
        required : [true, "Intention is required"]
    },
    answer: {
        type: String,
        required : [true, "Answer is required"]
    }
},{
    // we don't need the id so we set id to false
    _id: false
})

// behavioral question schema 
const behavioralQuestionSchema = new mongoose.Schema({

    question: {
        type: String,
        required : [true, "Technical question is required"]
    },
    intention: {
        type: String,
        required : [true, "Intention is required"]
    },
    answer: {
        type: String,
        required : [true, "Answer is required"]
    }
},{
    _id: false
})

// skill gap schema
const skillGapSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: [true, "Skill is required"]
    },
    severity: {
        type: String,
        enum: ["low", "medium", "high"],
        required: [true, "severity is required"]
    }
},{
    _id: false
})

// preparation plan
const preparationPlanSchema = new mongoose.Schema({
    day: {
        type: Number,
        required: [true, "Day is required"]
    },
    focus: {
        type: String,
        required: [true, "Focus is required"]
    },
    tasks: [{
        type: String,
        required: [true, "Task is required"]
    }]
})

// tailored resume content — the AI's structured output only, never LaTeX.
// resume.service.js escapes + templates this at render time, on every
// download, rather than storing an already-escaped or compiled copy.
const tailoredResumeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    emailDisplay: { type: String, required: true },
    emailUrl: { type: String, required: true },
    linkedinDisplay: { type: String, required: true },
    linkedinUrl: { type: String, required: true },
    githubDisplay: { type: String, required: true },
    githubUrl: { type: String, required: true },
    summary: { type: String, required: true },
    education: [{
        institution: { type: String, required: true },
        location: { type: String, required: true },
        degree: { type: String, required: true },
        dates: { type: String, required: true },
        _id: false
    }],
    experience: [{
        title: { type: String, required: true },
        company: { type: String, required: true },
        location: { type: String, required: true },
        dates: { type: String, required: true },
        bullets: [{ type: String }],
        _id: false
    }],
    projects: [{
        name: { type: String, required: true },
        tech: { type: String, required: true },
        dates: { type: String, required: true },
        linkUrl: { type: String },
        bullets: [{ type: String }],
        _id: false
    }],
    skills: [{
        category: { type: String, required: true },
        items: [{ type: String }],
        _id: false
    }]
},{
    _id: false
})

const interviewReportSchema = new mongoose.Schema({
    jobDescription: {
        type: String,
        required: [true, "Job description is required"]
    },
    resume:{
        type: String
    },
    selfDescription: {
        type: String
    },
    matchScore: {
        type: Number,
        min : 0,
        max : 100
    },
    provider: {
        type: String,
        enum: ["gemini", "nvidia", "huggingface"],
        default: "gemini"
    },
    technicalQuestion: [technicalQuestionSchema],
    behavioralQuestion: [behavioralQuestionSchema],
    skillGap: [skillGapSchema],
    preparationPlan: [preparationPlanSchema],
    tailoredResume: tailoredResumeSchema,
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users"
    },
    title: {
        type: String,
        required: [true, "Job title is required"]
    }

},{
    timestamps: true
})

/* we can also stored which model we use for stored this imformation in future */

const interviewReportModel = mongoose.model("InterviewReport", interviewReportSchema)

module.exports = interviewReportModel;