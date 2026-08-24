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
    ZeroFareMark,
} from "../components/icons.jsx"

const JOB_DESCRIPTION_MAX_CHARS = 5000

// Must match the provider ids the backend's PROVIDERS registry (ai.service.js) knows about.
const AI_PROVIDERS = [
    { id: "gemini", label: "Gemini", note: "~15 sec" },
    // The only provider here billed per token — the other three run on free
    // tiers, so the note says so rather than quoting a speed alone.
    { id: "openai", label: "ChatGPT · GPT-5.6 Luna", note: "fast · billed per use" },
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

/**
 * How much of the tape a field has used. Silent until the last tenth, then it
 * marks itself — a budget you only need to see when it starts to matter. Tabular
 * numerals so the figure does not jitter as it counts.
 */
const Gauge = ({ written }) => {
    const spent = written / JOB_DESCRIPTION_MAX_CHARS
    return (
        <p className={`gauge${spent >= 0.9 ? " is-short" : ""}${written === 0 ? " is-idle" : ""}`}>
            <span aria-hidden="true">
                {written.toLocaleString()} / {JOB_DESCRIPTION_MAX_CHARS.toLocaleString()}
            </span>
            {/* Announced only near the limit, so a screen reader is not read a
                running character count on every keystroke. */}
            {spent >= 0.9 && (
                <span className="gauge__called" role="status">
                    {JOB_DESCRIPTION_MAX_CHARS - written} characters left
                </span>
            )}
        </p>
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
    const [dragging, setDragging] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    // Length only — the fields stay uncontrolled and are still read via FormData
    // on submit. Binding `value` here would turn them into controlled inputs for
    // no gain and is exactly the switch that broke the auth forms before.
    const [written, setWritten] = useState({ jobDescription: 0, selfDescription: 0 })

    const fileInputRef = useRef(null)
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

    /* The papers are taken by hand or dropped on the counter — the control has
       always looked like a drop zone, so it should behave as one. The picker's
       FileList is read-only, so the dropped file is written back through a
       DataTransfer; that keeps `resume` a real form field and leaves the
       existing FormData submit path untouched. */
    const seatFile = (file) => {
        if (!file || !fileInputRef.current) return
        const carrier = new DataTransfer()
        carrier.items.add(file)
        fileInputRef.current.files = carrier.files
        setResumeName(file.name)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        seatFile(e.dataTransfer.files?.[0])
    }

    const handleGenerateReport = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        const jobDescription = formData.get('jobDescription')
        const selfDescription = formData.get('selfDescription')
        const resumeFile = formData.get('resume')

        if (!jobDescription) {
            setGenerationSummary([{ status: "error", providerLabel: "Check", message: "Name the destination — paste the job posting you are aiming at." }])
            return
        }
        /* The traveller and the papers are alternatives, so only the absence of
           both is a fault. Mirrors the same rule on the backend. */
        const hasPapers = resumeFile && resumeFile.size > 0
        if (!selfDescription && !hasPapers) {
            setGenerationSummary([{ status: "error", providerLabel: "Check", message: "Say who is travelling, or attach your resume — either one is enough." }])
            return
        }

        try {
            setSubmitting(true)
            setGenerationSummary([])
            const results = await generateReport({ jobDescription, selfDescription, resumeFile, providerId: selectedProvider })
            // Only one provider is ever requested here, so a successful run is
            // exactly one result — go straight to the report instead of making
            // the user find and click "Read it" in the signals list below.
            const success = results.find((result) => result.status === "success")
            if (success?.reportId) {
                navigate(`/interview/${success.reportId}`)
            }
        } catch (err) {
            // The backend answers refusals with a real reason (403 "Verify your
            // email to generate a report", 400 for a bad file, 429 when rate
            // limited). This used to be a bare `catch {}` that replaced every one
            // of them with the connection message — so a verified-email block read
            // as a network outage and sent people to check their wifi.
            // Only claim a connection problem when there is genuinely no response.
            const serverMessage = err?.response?.data?.message
            setGenerationSummary([{
                status: "error",
                providerLabel: err?.response ? "Depot" : "Line",
                message: serverMessage || "Could not reach the depot. Check your connection and try again."
            }])
        } finally {
            /* Released in `finally`, not after the await: on the error path the
               loading view never takes over, so without this the button would
               stay dead and the user could not retry. */
            setSubmitting(false)
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
                    <span className="blind__code">ZFR {String(reports.length).padStart(2, "0")}</span>
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
                        onChange={(e) => setWritten((w) => ({ ...w, jobDescription: e.target.value.length }))}
                        required
                    />
                    <Gauge written={written.jobDescription} />
                </section>

                <section className="works__course">
                    {/* Traveller and Papers are alternatives — `required` is off both,
                        and the pair is validated together on submit. */}
                    <label className="works__legend" htmlFor="selfDescription">
                        Traveller — who is going
                        <span className="works__either">either this</span>
                    </label>
                    <textarea
                        id="selfDescription"
                        name="selfDescription"
                        maxLength={JOB_DESCRIPTION_MAX_CHARS}
                        placeholder="Your experience, skills, and what you are aiming for."
                        onChange={(e) => setWritten((w) => ({ ...w, selfDescription: e.target.value.length }))}
                    />
                    <Gauge written={written.selfDescription} />

                    <label className="works__legend" htmlFor="resume">
                        Papers — your resume
                        <span className="works__either">or this</span>
                    </label>
                    {/* A label wrapper, so clicking the icon or the text opens the picker.
                        `required` is omitted deliberately: Chrome refuses to submit a form
                        with a required display:none control; the file is validated above. */}
                    <label
                        className={`drop${dragging ? " is-taking" : ""}${resumeName ? " is-seated" : ""}`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}>
                        {resumeName
                            ? <CheckIcon className="drop__icon" />
                            : <UploadCloudIcon className="drop__icon" />}
                        <span className="drop__text">
                            {dragging
                                ? "Let go — the counter has it"
                                : resumeName || "Attach resume — drop it here, or click to choose"}
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="resume"
                            name="resume"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => setResumeName(e.target.files?.[0]?.name ?? "")}
                        />
                    </label>

                    <p className="works__aside">
                        One of the two is enough. Give both and the read gets sharper.
                    </p>

                    <span className="works__legend works__legend--sub">Model</span>
                    <ProviderTape selected={selectedProvider} onSelect={setSelectedProvider} />
                </section>

                {/* Rank is inversion: the lead action alone prints dark on pale cloth. */}
                <footer className="works__foot">
                    <button type="submit" className="act act--lead" disabled={submitting}>
                        <SparkIcon />
                        {submitting ? "Setting the blind…" : "Print my interview"}
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

            {/* The roll is always set, empty or not: a first run used to end at the
                form with nothing beneath it, so the page read as half-built and gave
                no hint that anything is kept. An empty roll says where work lands. */}
            {reports.length === 0 ? (
                <section className="roll roll--bare">
                    <h2 className="roll__rule">Courses on the roll</h2>
                    <p className="roll__bare-note">
                        Nothing on the roll yet. Every interview you print is kept here —
                        the posting, the questions, and the match behind them.
                    </p>
                </section>
            ) : (
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

            {/* The About/Contact/Privacy nav was removed: none of those routes exist
                in app.routes.jsx, and as bare <a> tags they forced a full page reload
                into a route the router cannot answer. Dead links are worse than none —
                put them back here as <Link> once the pages exist. */}
            <footer className="depot__foot">
                <p className="depot__stamp">
                    {reports.length > 0
                        ? `${reports.length} printed`
                        : "Free to use — no fare, no account fee"}
                </p>
                <div className="brandmark brandmark--quiet">
                    <ZeroFareMark className="brandmark__icon" />
                    <span className="brandmark__word">ZeroFare</span>
                </div>
            </footer>
        </main>
    )
}

export default Home
