import React, { useEffect, useRef, useState } from 'react'
import { useInterview } from "../hooks/useInterview"
import { useNavigate, Link } from "react-router"
import "../style/home.scss"
import { snapStep, stepRank, riffle } from "../../../lib/animations/blind"
import {
    UploadCloudIcon,
    SparkIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    CheckIcon,
} from "../components/icons.jsx"

const JOB_DESCRIPTION_MAX_CHARS = 5000

// Must match the provider ids the backend's PROVIDERS registry (ai.service.js) knows about.
const AI_PROVIDERS = [
    { id: "gemini", label: "Gemini", note: "~15 sec" },
    { id: "nvidia", label: "NVIDIA · Llama 3.3 70B", note: "up to 2 min" },
    { id: "huggingface", label: "Hugging Face · Llama 3.1 8B", note: "up to 2 min" },
]

// Destinations the blind riffles through while the machine works. Real job
// titles, so the wait shows the product thinking rather than a spinner.
const RIFFLE_DESTINATIONS = [
    "READING RESUME", "MATCHING SKILLS", "WEIGHING GAPS",
    "DRAFTING QUESTIONS", "FINDING INTENT", "BUILDING ROADMAP",
]

/**
 * The provider selector, built as the punched eyelet tape running down the
 * edge of a blind: a fixed rank of coded holes, the live one struck through
 * in chrome-yellow. Radio semantics underneath so it stays keyboard-operable.
 */
const ProviderTape = ({ selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return
        const onClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false)
        }
        const onEscape = (e) => { if (e.key === "Escape") setIsOpen(false) }
        document.addEventListener("mousedown", onClickOutside)
        document.addEventListener("keydown", onEscape)
        return () => {
            document.removeEventListener("mousedown", onClickOutside)
            document.removeEventListener("keydown", onEscape)
        }
    }, [isOpen])

    const active = AI_PROVIDERS.find((p) => p.id === selected)

    return (
        <div className="tape" ref={containerRef}>
            <button
                type="button"
                className="tape__window"
                aria-haspopup="true"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((o) => !o)}
            >
                <span className="tape__eyelets" aria-hidden="true">
                    {AI_PROVIDERS.map((p) => (
                        <span key={p.id} className={`tape__eyelet${p.id === selected ? " is-live" : ""}`} />
                    ))}
                </span>
                <span className="tape__legend">{active?.label}</span>
                <ChevronDownIcon className={`tape__chevron${isOpen ? " is-open" : ""}`} />
            </button>

            {isOpen && (
                <div className="tape__rank" role="radiogroup" aria-label="Model">
                    {AI_PROVIDERS.map((provider) => (
                        <label key={provider.id} className="tape__course">
                            <input
                                type="radio"
                                name="provider"
                                checked={selected === provider.id}
                                onChange={() => { onSelect(provider.id); setIsOpen(false) }}
                            />
                            <span className="tape__course-label">{provider.label}</span>
                            <span className="tape__course-note">{provider.note}</span>
                            {selected === provider.id && <CheckIcon className="tape__check" />}
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}

const Home = () => {
    const {
        reports,
        loading,
        error,
        generationSummary,
        setGenerationSummary,
        generateReport,
        fetchReports
    } = useInterview()
    const navigate = useNavigate()
    const [selectedProvider, setSelectedProvider] = useState("gemini")
    const [resumeName, setResumeName] = useState("")

    const windowRef = useRef(null)
    const riffleRef = useRef(null)
    const panelRef = useRef(null)
    const rankRef = useRef(null)

    useEffect(() => { fetchReports() }, [fetchReports])

    // Entrance: the blind seats its destination, then the working panels step in.
    useEffect(() => {
        if (loading) return
        const a = snapStep(windowRef.current, { from: "70%" })
        const b = snapStep(panelRef.current, { from: "18%", delay: 0.1, duration: 0.5 })
        return () => { a?.kill(); b?.kill() }
    }, [loading])

    // The rank of saved reports steps in as one mechanism turning over.
    useEffect(() => {
        if (loading || !reports.length) return
        const t = stepRank(rankRef.current?.children, { delay: 0.05 })
        return () => t?.kill()
    }, [loading, reports.length])

    // While the machine works, the blind riffles through what it is doing.
    useEffect(() => {
        if (!loading) return
        const tl = riffle(riffleRef.current, RIFFLE_DESTINATIONS)
        return () => tl?.kill()
    }, [loading])

    const handleGenerateReport = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        const jobDescription = formData.get('jobDescription')
        const selfDescription = formData.get('selfDescription')
        const resumeFile = formData.get('resume')

        if (!jobDescription || !selfDescription) {
            setGenerationSummary([{ status: "error", providerLabel: "Check", message: "Name the destination and say who is travelling — both fields are needed." }])
            return
        }
        if (!resumeFile || resumeFile.size === 0) {
            setGenerationSummary([{ status: "error", providerLabel: "Check", message: "Attach a resume PDF so the blind has something to read." }])
            return
        }

        try {
            setGenerationSummary([])
            await generateReport({ jobDescription, selfDescription, resumeFile, providerId: selectedProvider })
        } catch {
            setGenerationSummary([{ status: "error", providerLabel: "Line", message: "Could not reach the depot. Check your connection and try again." }])
        }
    }

    // The wait is part of the product: the blind visibly searches for the
    // destination rather than hiding the machine behind a spinner.
    if (loading) {
        return (
            <main className="depot depot--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Finding your destination</p>
                    <p className="blind__course" ref={riffleRef}>READING RESUME</p>
                    <p className="blind__note">
                        {AI_PROVIDERS.find((p) => p.id === selectedProvider)?.label} is reading the posting
                        against your resume. Free models can take a couple of minutes.
                    </p>
                </div>
            </main>
        )
    }

    if (error) {
        return (
            <main className="depot depot--fault">
                <div className="blind blind--fault">
                    <p className="blind__rule">Service fault</p>
                    <p className="blind__course">OUT OF SERVICE</p>
                    <p className="blind__note">{error}</p>
                    <button className="act" onClick={() => fetchReports()}>Run again</button>
                </div>
            </main>
        )
    }

    return (
        <main className="depot">
            {/* The fixed window: the destination the whole surface is about. */}
            {/* The fixed window: a real aperture the course steps under, not a
                bare headline. No kicker above it — the floor bans that outright
                and the brand already prints in the footer. */}
            <header className="blind" ref={windowRef}>
                <div className="blind__window">
                    <span className="blind__code">NQX 27</span>
                    <h1 className="blind__course">YOUR NEXT INTERVIEW</h1>
                </div>
                <p className="blind__note">
                    Name the job. The blind reads it against your resume and prints the
                    interview you are about to sit — every question, and why they ask it.
                </p>
            </header>

            <form className="works" onSubmit={handleGenerateReport} ref={panelRef}>
                <section className="works__course">
                    <label className="works__legend" htmlFor="jobDescription">Destination — the job posting</label>
                    <textarea
                        id="jobDescription"
                        name="jobDescription"
                        maxLength={JOB_DESCRIPTION_MAX_CHARS}
                        placeholder="Paste the full job description here."
                        required
                    />
                </section>

                <section className="works__course">
                    <label className="works__legend" htmlFor="selfDescription">Traveller — who is going</label>
                    <textarea
                        id="selfDescription"
                        name="selfDescription"
                        maxLength={JOB_DESCRIPTION_MAX_CHARS}
                        placeholder="Your experience, skills, and what you are aiming for."
                        required
                    />

                    <label className="works__legend" htmlFor="resume">Papers — your resume</label>
                    {/* A label wrapper, so clicking the icon or the text opens the picker.
                        `required` is omitted deliberately: Chrome refuses to submit a form
                        with a required display:none control; the file is validated above. */}
                    <label className="drop">
                        <UploadCloudIcon className="drop__icon" />
                        <span className="drop__text">{resumeName || "Attach resume — PDF, DOC or DOCX"}</span>
                        <input
                            type="file"
                            id="resume"
                            name="resume"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => setResumeName(e.target.files?.[0]?.name ?? "")}
                        />
                    </label>

                    <span className="works__legend works__legend--sub">Model</span>
                    <ProviderTape selected={selectedProvider} onSelect={setSelectedProvider} />
                </section>

                {/* Rank is inversion: the lead action alone prints dark on pale cloth. */}
                <footer className="works__foot">
                    <button type="submit" className="act act--lead">
                        <SparkIcon />
                        Print my interview
                    </button>
                </footer>
            </form>

            {generationSummary.length > 0 && (
                <section className="signals" aria-live="polite">
                    {generationSummary.map((result, index) => (
                        <article key={result.provider ?? index} className={`signal signal--${result.status}`}>
                            <p className="signal__legend">{result.providerLabel}</p>
                            <p className="signal__note">{result.message}</p>
                            {result.status === "success" && (
                                <button className="act act--quiet" onClick={() => navigate(`/interview/${result.reportId}`)}>
                                    Read it <ChevronRightIcon />
                                </button>
                            )}
                        </article>
                    ))}
                </section>
            )}

            {reports.length > 0 && (
                <section className="roll">
                    <h2 className="roll__rule">Courses on the roll</h2>
                    {/* Identical ruled furniture on every card, so the rank scans in one pass. */}
                    <ul className="roll__rank" ref={rankRef}>
                        {reports.map((report) => (
                            <li key={report._id} className="course">
                                <Link className="course__link" to={`/interview/${report._id}`}>
                                    <span className="course__legend">{report.title || "Untitled"}</span>
                                    <span className="course__facts">
                                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                                        <span>{report.provider ?? "—"}</span>
                                        <span className="course__score">
                                            {typeof report.matchScore === "number" ? `${report.matchScore}%` : "—"}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="course__arrow" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <footer className="depot__foot">
                <nav className="depot__links">
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                    <a href="/privacy">Privacy</a>
                </nav>
                <p className="depot__stamp">Interview Strategy Generator</p>
            </footer>
        </main>
    )
}

export default Home
