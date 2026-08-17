import React, { useState } from 'react'
import "../style/interview.scss"
import { useInterview } from "../hooks/useInterview"
import { DownloadIcon } from "../components/icons.jsx"

/**
 * Report detail page, rendered at /interview/:interviewId.
 *
 * `report` is one interview-report document (matchScore, technicalQuestion[],
 * behavioralQuestion[], skillGap[], preparationPlan[]). useInterview() reads
 * :interviewId itself (via useParams internally) and fetches the matching
 * report on mount — this component only renders whatever it returns.
 *
 * activeSection is local view state (which of the three tabs is open), not
 * data that needs to survive a refetch or be shared elsewhere.
 */

// Renders one tab's list of Q&A cards. Shared by both the technical and
// behavioral sections since they're the same shape.
const QuestionList = ({ questions }) => {
    if (!questions.length) {
        return <p className='empty-note'>No questions in this section yet.</p>
    }

    return (
        <ol className='question-list'>
            {questions.map((item, index) => (
                <li className='question-card' key={item.question ?? index}>
                    <span className='question-card__index'>{index + 1}</span>
                    <h3 className='question-card__question'>{item.question}</h3>

                    <div className='question-card__block'>
                        <p className='question-card__label'>Why they ask this</p>
                        <p className='question-card__body'>{item.intention}</p>
                    </div>

                    <div className='question-card__block question-card__block--answer'>
                        <p className='question-card__label'>How to answer</p>
                        <p className='question-card__body'>{item.answer}</p>
                    </div>
                </li>
            ))}
        </ol>
    )
}

// Renders the day-by-day preparation plan as a numbered list of task cards.
const Roadmap = ({ plan }) => {
    if (!plan.length) {
        return <p className='empty-note'>No preparation plan yet.</p>
    }

    return (
        <ol className='roadmap'>
            {plan.map((entry, index) => (
                <li className='roadmap__day' key={entry._id ?? entry.day ?? index}>
                    <div className='roadmap__marker'>
                        <span className='roadmap__day-label'>Day</span>
                        <span className='roadmap__day-number'>{entry.day}</span>
                    </div>

                    <div className='roadmap__content'>
                        <h3 className='roadmap__focus'>{entry.focus}</h3>
                        <ul className='roadmap__tasks'>
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

// Left-rail tab definitions — id matches activeSection, label is the
// heading shown above the content once that tab is selected.
const SECTIONS = [
    { id: "technical", label: "Technical Questions" },
    { id: "behavioral", label: "Behavioral Questions" },
    { id: "roadmap", label: "Preparation Roadmap" },
]

const Interview = () => {

    const [activeSection, setActiveSection] = useState("technical")
    const [resumeError, setResumeError] = useState(null)
    // report starts out null until useInterview's effect resolves the fetch,
    // so every read below falls back to an empty value via `?.` / `??`.
    const { report, loading, downloadResume, downloadingResume } = useInterview()

    const handleDownloadResume = async () => {
        setResumeError(null)
        try {
            await downloadResume(report._id)
        } catch (error) {
            setResumeError(error.message || "Failed to generate the tailored resume. Please try again.")
        }
    }

    const technicalQuestion = report?.technicalQuestion ?? []
    const behavioralQuestion = report?.behavioralQuestion ?? []
    const preparationPlan = report?.preparationPlan ?? []
    const skillGap = report?.skillGap ?? []
    const matchScore = report?.matchScore

    const activeLabel =
        SECTIONS.find((section) => section.id === activeSection)?.label ?? ""

    if (loading) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview report...</h1>
            </main>
        )
    }

    // Picks which panel to show in the main column for the active tab.
    const renderSection = () => {
        if (activeSection === "technical") {
            return <QuestionList questions={technicalQuestion} />
        }

        if (activeSection === "behavioral") {
            return <QuestionList questions={behavioralQuestion} />
        }

        return <Roadmap plan={preparationPlan} />
    }

    const sectionCount = {
        technical: technicalQuestion.length,
        behavioral: behavioralQuestion.length,
        roadmap: preparationPlan.length,
    }

    return (
        <main className='interview'>
            {/* Left rail: tab switcher between the three report sections. */}
            <nav className='interview__rail interview__rail--left' aria-label='Report sections'>
                <ul className='section-nav'>
                    {SECTIONS.map((section) => {
                        const isActive = section.id === activeSection

                        return (
                            <li key={section.id}>
                                <button
                                    type='button'
                                    className={`section-nav__item${isActive ? " section-nav__item--active" : ""}`}
                                    aria-current={isActive ? "true" : undefined}
                                    onClick={() => setActiveSection(section.id)}
                                >
                                    <span className='section-nav__label'>{section.label}</span>
                                    <span className='section-nav__count'>{sectionCount[section.id]}</span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Main column: header with match score, then the active tab's content. */}
            <section className='interview__main' aria-live='polite'>
                <header className='interview__main-header'>
                    <h1 className='interview__title'>{activeLabel}</h1>
                    <div className='interview__header-actions'>
                        {typeof matchScore === "number" && (
                            <p className='match-score'>
                                <span className='match-score__label'>Match</span>
                                <span className='match-score__value'>{matchScore}%</span>
                            </p>
                        )}
                        {report && (
                            <button
                                type='button'
                                className='button resume-download-button'
                                onClick={handleDownloadResume}
                                disabled={downloadingResume}
                                aria-describedby={resumeError ? 'resume-download-error' : undefined}
                            >
                                <DownloadIcon />
                                {downloadingResume ? "Generating..." : "Download Tailored Resume"}
                            </button>
                        )}
                    </div>
                </header>

                {resumeError && (
                    <p id='resume-download-error' className='resume-download-error' role='alert'>{resumeError}</p>
                )}

                <div className='interview__content'>
                    {report ? renderSection() : <p className='empty-note'>No report loaded.</p>}
                </div>
            </section>

            {/* Right rail: always-visible skill gaps, independent of the active tab. */}
            <aside className='interview__rail interview__rail--right' aria-labelledby='skillGapHeading'>
                <h2 id='skillGapHeading' className='rail-heading'>Skill Gaps</h2>

                {skillGap.length ? (
                    <ul className='skill-gaps'>
                        {skillGap.map((gap, index) => (
                            <li
                                className={`skill-chip skill-chip--${gap.severity ?? "low"}`}
                                key={gap.skill ?? index}
                            >
                                <span className='skill-chip__name'>{gap.skill}</span>
                                <span className='skill-chip__severity'>{gap.severity}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className='empty-note'>No gaps identified.</p>
                )}
            </aside>
        </main>
    )
}

export default Interview
