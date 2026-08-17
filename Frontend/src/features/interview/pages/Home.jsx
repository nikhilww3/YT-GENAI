import React, { useState } from 'react'
import { useInterview }  from "../hooks/useInterview"
import { useNavigate } from "react-router"
import "../style/home.scss"
import {
    BriefcaseIcon,
    UserIcon,
    UploadCloudIcon,
    InfoIcon,
    SparkIcon,
    ChevronRightIcon,
} from "../components/icons.jsx"



const JOB_DESCRIPTION_MAX_CHARS = 5000

/**
 * Landing page: the "generate a new report" form, plus a list of the
 * user's previously generated reports below it.
 *
 * `reports` (the history list) is fetched automatically by useInterview's
 * internal effect on mount — there is no route param here, so it calls
 * getAllInterviewReports() rather than a single-report lookup.
 */
const Home = () => {
    // Controlled form fields — mirrors what the user currently sees in the inputs.
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const [resumeFile, setResumeFile] = useState(null)
    // Purely visual: toggles the dashed drop-zone highlight while a file is dragged over it.
    const [isDragging, setIsDragging] = useState(false)

    const { loading, generateReport, reports } = useInterview()
    const navigate = useNavigate()

    const handleResumeChange = (e) => {
        setResumeFile(e.target.files?.[0] ?? null)
    }

    const handleDragOver = (e) => {
        // Without preventDefault the browser rejects the drop entirely.
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => setIsDragging(false)

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        setResumeFile(e.dataTransfer.files?.[0] ?? null)
    }

    // Submits the form: generates the report, then jumps straight to its detail page.
    const handleSubmit = async (e) => {
        e.preventDefault()
        const data = await generateReport({ jobDescription, selfDescription, resumeFile })
        navigate(`/interview/${data._id}`)
    }

    // `loading` covers both "fetching past reports" and "generating a new one" —
    // either way there's nothing useful to show yet, so block on a single screen.
    if(loading) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview strategy...</h1>
            </main>
        )
    }
        

    return (
        <main className='home'>
            <header className='home__header'>
                <h1 className='home__title'>
                    Create Your Custom <span className='highlight'>Interview Plan</span>
                </h1>
                <p className='home__subtitle'>
                    Let our AI analyze the job requirements and your unique profile to
                    build a winning strategy.
                </p>
            </header>

            <form className='interview-card' onSubmit={handleSubmit} noValidate>
                <div className='interview-input-group'>
                    {/* Left panel: the job posting the report is generated against. */}
                    <section className='left' aria-labelledby='jobDescriptionHeading'>
                        <div className='panel-heading'>
                            <h2 id='jobDescriptionHeading' className='panel-heading__title'>
                                <BriefcaseIcon className='panel-heading__icon' />
                                Target Job Description
                            </h2>
                            <span className='badge badge--required'>Required</span>
                        </div>

                        <div className='textarea-shell'>
                            <label className='sr-only' htmlFor='jobDescription'>
                                Target job description
                            </label>
                            <textarea
                                onChange={(e) => setJobDescription(e.target.value)}
                                id='jobDescription'
                                name='jobDescription'
                                maxLength={JOB_DESCRIPTION_MAX_CHARS}
                                value={jobDescription}
                                placeholder={"Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'"}
                            />
                            <span className='char-count'>
                                {jobDescription.length} / {JOB_DESCRIPTION_MAX_CHARS} chars
                            </span>
                        </div>
                    </section>

                    {/* Right panel: who the candidate is — a resume upload, or a quick
                        typed description when they don't have one handy. */}
                    <section className='right' aria-labelledby='profileHeading'>
                        <div className='panel-heading'>
                            <h2 id='profileHeading' className='panel-heading__title'>
                                <UserIcon className='panel-heading__icon' />
                                Your Profile
                            </h2>
                        </div>

                        <div className='input-group'>
                            <p className='field-label'>
                                Upload Resume
                                <span className='badge badge--best'>Best results</span>
                            </p>
                            <label
                                className={`file-label${isDragging ? " file-label--dragging" : ""}`}
                                htmlFor='resume'
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <UploadCloudIcon className='file-label__icon' />
                                <span className='file-label__title'>
                                    {resumeFile ? resumeFile.name : "Click to upload or drag & drop"}
                                </span>
                                <small className='file-label__hint'>PDF or DOCX (Max 5MB)</small>
                            </label>
                            <input
                                hidden
                                type='file'
                                id='resume'
                                name='resume'
                                accept='.pdf,.docx'
                                onChange={handleResumeChange}
                            />
                        </div>

                        <div className='divider'>
                            <span>OR</span>
                        </div>

                        <div className='input-group input-group--grow'>
                            <label className='field-label' htmlFor='selfDescription'>
                                Quick Self-Description
                            </label>
                            <textarea
                                onChange={(e) => setSelfDescription(e.target.value)}
                                id='selfDescription'
                                name='selfDescription'
                                value={selfDescription}
                                placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                            />
                        </div>

                        <p className='hint-banner'>
                            <InfoIcon className='hint-banner__icon' />
                            <span>
                                Either a <strong>Resume</strong> or a <strong>Self Description</strong> is
                                required to generate a personalized plan.
                            </span>
                        </p>
                    </section>
                </div>

                {/* History list — only the fields the "list all" endpoint returns
                    (title, matchScore, createdAt); the full report body is fetched
                    separately once the user opens one. */}
                {reports.length > 0 && (
                    <section className='reports-section' aria-labelledby='reportsHeading'>
                        <h2 id='reportsHeading' className='reports-section__heading'>Recent Reports</h2>
                        <ul className='reports-grid'>
                            {reports.map((report) => (
                                <li key={report._id} className='report-card'>
                                    {/* A <button> (not a click handler on the <li>) so the
                                        card is keyboard- and screen-reader-accessible. */}
                                    <button
                                        type='button'
                                        className='report-card__button'
                                        onClick={() => navigate(`/interview/${report._id}`)}
                                    >
                                        <span className='report-card__info'>
                                            <span className='report-card__title'>{report.title || "Untitled Report"}</span>
                                            <span className='report-card__meta'>
                                                Generated {new Date(report.createdAt).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        </span>
                                        <span className='report-card__aside'>
                                            {typeof report.matchScore === "number" && (
                                                <span className='report-card__score'>{report.matchScore}% match</span>
                                            )}
                                            <ChevronRightIcon className='report-card__chevron' />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* disabled + label swap double as the loading indicator for this submit. */}
                <footer className='interview-card__footer'>
                    <p className='footer-note'>AI-Powered Strategy Generation &bull; Approx 30s</p>
                    <button
                        type='submit'
                        className='button primary-button submit-button'
                        disabled={loading}
                    >
                        <SparkIcon />
                        {loading ? "Generating..." : "Generate My Interview Strategy"}
                    </button>
                </footer>
            </form>

            <nav className='home__links' aria-label='Legal and support'>
                <a href='/privacy'>Privacy Policy</a>
                <a href='/terms'>Terms of Service</a>
                <a href='/help'>Help Center</a>
            </nav>
        </main>
    )
}

export default Home
