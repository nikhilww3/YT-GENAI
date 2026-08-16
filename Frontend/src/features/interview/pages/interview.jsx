import React, { useState, useEffect } from 'react'
import "../style/interview.scss"
import { useInterview } from "../hooks/useInterview"
import { useParams, useNavigate } from "react-router"

/**
 * UI layer only — pure presentational.
 *
 * `report` is one interview-report document (matchScore, technicalQuestion[],
 * behavioralQuestion[], skillGap[], preparationPlan[]). The hook/state/api
 * layers fetch it by :interviewId and pass it in; this file only renders.
 *
 * activeSection is view state (which tab is open), not application state.
 */



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

const Interview = ({ report = null }) => {

    const [activeSection, setActiveSection] = useState("technical")
    const { report, getReportById, loading } = useInterview()
    const { interviewId } = useParams()

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [interviewId, getReportById])

    const technicalQuestion = report?.technicalQuestion ?? []
    const behavioralQuestion = report?.behavioralQuestion ?? []
    const preparationPlan = report?.preparationPlan ?? []
    const skillGap = report?.skillGap ?? []
    const matchScore = report?.matchScore

    const activeLabel =
        report.find((section) => section.id === activeSection)?.label ?? ""

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

            <section className='interview__main' aria-live='polite'>
                <header className='interview__main-header'>
                    <h1 className='interview__title'>{activeLabel}</h1>
                    {typeof matchScore === "number" && (
                        <p className='match-score'>
                            <span className='match-score__label'>Match</span>
                            <span className='match-score__value'>{matchScore}%</span>
                        </p>
                    )}
                </header>

                <div className='interview__content'>
                    {report ? renderSection() : <p className='empty-note'>No report loaded.</p>}
                </div>
            </section>

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
