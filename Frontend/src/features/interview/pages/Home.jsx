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
} from "../components/icons.jsx"



const JOB_DESCRIPTION_MAX_CHARS = 5000

/**
 * UI layer.
 *
 * The useState calls below are view-only state (what the inputs currently show).
 * When the state layer lands, lift these into it and pass the values back in as
 * props — the markup below does not change.
 */
const Home = ({ isSubmitting = false, onSubmit = () => {} }) => {
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const [resumeFile, setResumeFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleResumeChange = (e) => {
        setResumeFile(e.target.files?.[0] ?? null)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => setIsDragging(false)

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        setResumeFile(e.dataTransfer.files?.[0] ?? null)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit({ jobDescription, selfDescription, resume: resumeFile })
    }

    const { loading , generateReport } = useInterview()
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const resumeInputRef = useRef()

    const navigate = useNavigate()

    const handleGenerateReport = async () => {

        const resumeFile = resumeInputRef.current.files[0]
        const data = await generateReport({ jobDescription, selfDescription, resumeFile })
        navigate(`/interview/${data._id}`)
    }

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
                                onChange={(e) => {setJobDescription(e.target.value)}}
                                id='jobDescription'
                                name='jobDescription'
                                maxLength={JOB_DESCRIPTION_MAX_CHARS}
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder={"Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'"}
                            />
                            <span className='char-count'>
                                {jobDescription.length} / {JOB_DESCRIPTION_MAX_CHARS} chars
                            </span>
                        </div>
                    </section>

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
                                ref={resumeInputRef}
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
                                onChange={(e) => {setSelfDescription(e.target.value)}}
                                id='selfDescription'
                                name='selfDescription'
                                value={selfDescription}
                                onChange={(e) => setSelfDescription(e.target.value)}
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

                <footer className='interview-card__footer'>
                    <p className='footer-note'>AI-Powered Strategy Generation &bull; Approx 30s</p>
                    <button
                        onClick={handleGenerateReport}
                        type='submit'
                        className='button primary-button submit-button'
                        disabled={isSubmitting}
                    >
                        <SparkIcon />
                        {isSubmitting ? "Generating..." : "Generate My Interview Strategy"}
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
