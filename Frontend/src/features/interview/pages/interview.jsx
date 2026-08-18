import React, { useEffect, useRef, useState } from 'react'
import "../style/interview.scss"
import { useInterview } from "../hooks/useInterview"
import { Link, useParams } from "react-router"
import { snapStep, stepRank, invertIn, countUp, riffle } from "../../../lib/animations/blind"
import { DownloadIcon, CodeIcon, ChevronRightIcon } from "../components/icons.jsx"

/**
 * Report detail page at /interview/:interviewId, in the Depot Blind world.
 *
 * The three sections are courses on one roll: selecting a course steps it under
 * the fixed window, and the others recede. useInterview() reads :interviewId
 * itself and fetches on mount; this component only renders what it returns.
 */

const SECTIONS = [
    { id: "technical", label: "Technical" },
    { id: "behavioral", label: "Behavioral" },
    { id: "roadmap", label: "Roadmap" },
]

const WORKING_COURSES = ["READING REPORT", "SETTING COURSES", "PRINTING"]

const QuestionList = ({ questions, listRef }) => {
    if (!questions.length) {
        // Absence drawn as deliberately as presence: a bared weave, not blank space.
        return <p className="bare">This course is empty — nothing was printed here.</p>
    }

    return (
        <ol className="qa" ref={listRef}>
            {questions.map((item, index) => (
                <li className="qa__item" key={item.question ?? index}>
                    <span className="qa__no">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="qa__q">{item.question}</h3>

                    <div className="qa__block">
                        <p className="qa__label">Why they ask this</p>
                        <p className="qa__body">{item.intention}</p>
                    </div>

                    <div className="qa__block qa__block--answer">
                        <p className="qa__label">How to answer</p>
                        <p className="qa__body">{item.answer}</p>
                    </div>
                </li>
            ))}
        </ol>
    )
}

const Roadmap = ({ plan, listRef }) => {
    if (!plan.length) {
        return <p className="bare">No preparation plan was printed for this report.</p>
    }

    return (
        <ol className="plan" ref={listRef}>
            {plan.map((entry, index) => (
                <li className="plan__day" key={entry._id ?? entry.day ?? index}>
                    <div className="plan__marker">
                        <span className="plan__day-label">Day</span>
                        <span className="plan__day-no">{entry.day}</span>
                    </div>
                    <div className="plan__content">
                        <h3 className="plan__focus">{entry.focus}</h3>
                        <ul className="plan__tasks">
                            {(entry.tasks ?? []).map((task, taskIndex) => (
                                <li key={task ?? taskIndex}>{task}</li>
                            ))}
                        </ul>
                    </div>
                </li>
            ))}
        </ol>
    )
}

const Interview = () => {
    const [activeSection, setActiveSection] = useState("technical")
    const [resumeError, setResumeError] = useState(null)
    const [resumeLatexError, setResumeLatexError] = useState(null)
    const {
        report, loading, error, getReportById,
        downloadResume, downloadingResume,
        downloadResumeLatex, downloadingResumeLatex,
    } = useInterview()
    const { interviewId } = useParams()

    const windowRef = useRef(null)
    const scoreRef = useRef(null)
    const scorePanelRef = useRef(null)
    const listRef = useRef(null)
    const riffleRef = useRef(null)
    const latexRiffleRef = useRef(null)
    const fetchRiffleRef = useRef(null)

    const technicalQuestion = report?.technicalQuestion ?? []
    const behavioralQuestion = report?.behavioralQuestion ?? []
    const preparationPlan = report?.preparationPlan ?? []
    const skillGap = report?.skillGap ?? []
    const matchScore = report?.matchScore

    const counts = {
        technical: technicalQuestion.length,
        behavioral: behavioralQuestion.length,
        roadmap: preparationPlan.length,
    }

    // The destination seats itself, then the score panel inverts into rank.
    useEffect(() => {
        if (loading || !report) return
        const a = snapStep(windowRef.current, { from: "60%" })
        const b = invertIn(scorePanelRef.current, { delay: 0.15 })
        const c = typeof matchScore === "number"
            ? countUp(scoreRef.current, matchScore, { delay: 0.3 })
            : null
        return () => { a?.kill(); b?.kill(); c?.kill() }
    }, [loading, report, matchScore])

    // Changing course steps the new one under the window.
    useEffect(() => {
        if (loading || !report) return
        const t = stepRank(listRef.current?.children, { stagger: 0.04 })
        return () => t?.kill()
    }, [activeSection, loading, report])

    useEffect(() => {
        if (!downloadingResume) return
        const tl = riffle(riffleRef.current, WORKING_COURSES)
        return () => tl?.kill()
    }, [downloadingResume])

    useEffect(() => {
        if (!downloadingResumeLatex) return
        const tl = riffle(latexRiffleRef.current, WORKING_COURSES)
        return () => tl?.kill()
    }, [downloadingResumeLatex])

    // The report fetch riffles through the same working courses as the
    // resume print, so the wait reads as one mechanism rather than two.
    useEffect(() => {
        if (!loading) return
        const tl = riffle(fetchRiffleRef.current, WORKING_COURSES)
        return () => tl?.kill()
    }, [loading])

    const handleDownloadResume = async () => {
        setResumeError(null)
        try {
            await downloadResume(report._id)
        } catch (err) {
            setResumeError(err.message || "The resume could not be printed. Try again.")
        }
    }

    const handleDownloadResumeLatex = async () => {
        setResumeLatexError(null)
        try {
            await downloadResumeLatex(report._id)
        } catch (err) {
            setResumeLatexError(err.message || "The LaTeX source could not be printed. Try again.")
        }
    }

    if (loading) {
        return (
            <main className="depot depot--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Fetching report</p>
                    <p className="blind__course" ref={fetchRiffleRef}>READING REPORT</p>
                    <p className="blind__note">Pulling your saved report from the depot.</p>
                </div>
            </main>
        )
    }

    if (error || !report) {
        return (
            <main className="depot depot--fault">
                <div className="blind blind--fault">
                    <p className="blind__rule">Service fault</p>
                    <p className="blind__course">NOT ON THE ROLL</p>
                    <p className="blind__note">{error || "This report could not be found."}</p>
                    <div className="blind__actions">
                        <button className="act" onClick={() => getReportById(interviewId)}>Try again</button>
                        <Link className="act act--quiet" to="/">Back to the depot</Link>
                    </div>
                </div>
            </main>
        )
    }

    const renderCourse = () => {
        if (activeSection === "technical") return <QuestionList questions={technicalQuestion} listRef={listRef} />
        if (activeSection === "behavioral") return <QuestionList questions={behavioralQuestion} listRef={listRef} />
        return <Roadmap plan={preparationPlan} listRef={listRef} />
    }

    return (
        <main className="report">
            <header className="report__head" ref={windowRef}>
                <Link className="report__back" to="/">
                    <ChevronRightIcon className="report__back-arrow" /> Depot
                </Link>
                <div className="blind__window">
                    <span className="blind__code">{(report.provider ?? "rep").slice(0, 3).toUpperCase()} {String(matchScore ?? 0).padStart(2, "0")}</span>
                    <h1 className="report__course">{report.title || "Untitled"}</h1>
                </div>
            </header>

            {/* Rank is inversion: the score alone prints dark on pale cloth. */}
            <section className="score" ref={scorePanelRef}>
                <p className="score__legend">Match</p>
                <p className="score__value">
                    <span ref={scoreRef}>{typeof matchScore === "number" ? 0 : "—"}</span>
                    {typeof matchScore === "number" && <span className="score__pct">%</span>}
                </p>
                <button
                    className="act act--lead score__act"
                    onClick={handleDownloadResume}
                    disabled={downloadingResume}
                    aria-describedby={resumeError ? "resume-fault" : undefined}
                >
                    <DownloadIcon />
                    {downloadingResume ? "Printing…" : "Print tailored resume"}
                </button>
                <button
                    className="act act--quiet score__act score__act--latex"
                    onClick={handleDownloadResumeLatex}
                    disabled={downloadingResumeLatex}
                    aria-describedby={resumeLatexError ? "resume-latex-fault" : undefined}
                >
                    <CodeIcon />
                    {downloadingResumeLatex ? "Printing…" : "Download LaTeX source"}
                </button>
                {downloadingResume && (
                    <p className="score__working" ref={riffleRef} aria-live="polite">READING REPORT</p>
                )}
                {downloadingResumeLatex && (
                    <p className="score__working" ref={latexRiffleRef} aria-live="polite">READING REPORT</p>
                )}
                {resumeError && (
                    <p id="resume-fault" className="score__fault" role="alert">{resumeError}</p>
                )}
                {resumeLatexError && (
                    <p id="resume-latex-fault" className="score__fault" role="alert">{resumeLatexError}</p>
                )}
            </section>

            <div className="report__body">
                {/* The roll: selecting a course steps it under the window. */}
                <nav className="courses" aria-label="Report sections">
                    {SECTIONS.map((section) => {
                        const isLive = section.id === activeSection
                        return (
                            <button
                                key={section.id}
                                type="button"
                                className={`courses__item${isLive ? " is-live" : ""}`}
                                aria-current={isLive ? "true" : undefined}
                                onClick={() => setActiveSection(section.id)}
                            >
                                <span className="courses__label">{section.label}</span>
                                <span className="courses__count">{counts[section.id]}</span>
                            </button>
                        )
                    })}
                </nav>

                <section className="window" aria-live="polite">
                    {renderCourse()}
                </section>

                <aside className="gaps" aria-labelledby="gaps-rule">
                    <h2 id="gaps-rule" className="gaps__rule">Skill gaps</h2>
                    {skillGap.length ? (
                        <ul className="gaps__list">
                            {/* Magnitude as material weight: severity sets the bar's mass. */}
                            {skillGap.map((gap, index) => (
                                <li className={`gap gap--${gap.severity ?? "low"}`} key={gap.skill ?? index}>
                                    <span className="gap__name">{gap.skill}</span>
                                    <span className="gap__sev">{gap.severity}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="bare">No gaps were identified.</p>
                    )}
                </aside>
            </div>
        </main>
    )
}

export default Interview
