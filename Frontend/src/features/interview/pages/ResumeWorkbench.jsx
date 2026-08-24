import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from "react-router"
import "../style/workbench.scss"
import { useParserView } from "../hooks/useParserView"
import { useAtsAnalysis } from "../hooks/useAtsAnalysis"
import { useResumeDraft } from "../hooks/useResumeDraft"
import { useResumePreview } from "../hooks/useResumePreview"
import { useLatexCompile } from "../hooks/useLatexCompile"
import LatexEditor from "../components/LatexEditor"
import { snapStep, riffle } from "../../../lib/animations/blind"
import { ChevronRightIcon } from "../components/icons.jsx"

// Destinations the blind riffles through while the resume is compiled and read.
const READING_COURSES = [
    "RENDERING SOURCE", "COMPILING RESUME", "READING TEXT LAYER",
]

/* Ordered by what the reader should act on, not by severity: the absent ones are
   the real work, the listed-only ones are the cheap wins, and what is already
   evidenced comes last because it needs nothing. */
const REQUIREMENT_GROUPS = [
    {
        status: "missing",
        legend: "Not in your resume",
        note: "The posting asks for these and they do not appear at all. Add them only where they are genuinely true of you.",
    },
    {
        status: "listed",
        legend: "Named but never shown",
        note: "These sit in a list without being demonstrated. A recruiter — and a skills-graph parser — weighs a skill far higher when a role bullet proves it.",
    },
    {
        status: "evidenced",
        legend: "Demonstrated",
        note: "These already appear inside your experience with context. Nothing to do.",
    },
]

/* Folds text down to bare lowercase words. The source pane holds LaTeX-escaped
   text ("40\%", "R\&D") while the suggestions hold plain prose, so matching one
   against the other only works once both sides lose their punctuation. */
const fold = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

// Depot vocabulary rather than PASS/WARN/FAIL: this reads as an inspection slip.
const STATUS_WORD = {
    pass: "CLEAR",
    warn: "CHECK",
    fail: "FAULT",
}

/**
 * The resume workbench. First occupant: the parser's view — the resume's text
 * layer exactly as an applicant tracking system receives it. Everything else
 * (checks, keywords, score, suggestions) lands on this bench afterwards.
 */
const ResumeWorkbench = () => {
    const { interviewId } = useParams()

    const { status, parserView, fault, read, retry } = useParserView(interviewId)
    const { status: atsStatus, analysis, fault: atsFault, analyse, retry: atsRetry } = useAtsAnalysis(interviewId)
    const [streamOpen, setStreamOpen] = useState(false)

    const riffleRef = useRef(null)
    const panelRef = useRef(null)

    /* After any edit both halves are stale: the compiled resume changed, so the
       parser view must be re-read, and the score must be re-taken against the new
       text. Refreshed in place rather than through retry() so the page does not
       collapse back to the loading blind on every applied suggestion. */
    const { url: previewUrl, status: previewStatus, fault: previewFault, load: loadPreview } =
        useResumePreview(interviewId)

    const refresh = useCallback(async () => {
        await Promise.all([read(), analyse(), loadPreview()])
    }, [read, analyse, loadPreview])

    const { applySuggestion, undo, restoreGenerated, canUndo, busy, fault: draftFault } =
        useResumeDraft(interviewId, { onChanged: refresh })

    // Text the user has adjusted before applying — keyed by suggestion index, and
    // only ever populated for suggestions carrying a blank to fill.
    const [drafted, setDrafted] = useState({})
    const [highlightLine, setHighlightLine] = useState(null)
    const sourceRef = useRef(null)
    const sourceLines = (parserView.tex || "").split("\n")

    const { compile, revert: revertTex, url: compiledUrl, error: compileError, busy: compiling } =
        useLatexCompile(interviewId)
    const [editing, setEditing] = useState(false)

    /* Derived, not synced. `texOverride` is null until the user types, so the
       editor shows whatever the server last sent and follows it as the resume
       changes underneath — then holds the user's text the moment they touch it.
       Storing a copy and syncing it in an effect would both cascade renders and
       risk overwriting half-typed text when a suggestion is applied. */
    const [texOverride, setTexOverride] = useState(null)
    const tex = texOverride ?? parserView.tex ?? ""

    const handleCompile = async () => {
        const ok = await compile(tex)
        // Only re-read once it built: the analysis and checks describe a compiled
        // document, and running them against a failed build would report on the
        // previous version while the editor shows an error.
        if (ok) await refresh()
    }

    const handleRevertTex = async () => {
        if (await revertTex()) {
            // Drop the local copy so the editor follows the server again.
            setTexOverride(null)
            setEditing(false)
            await refresh()
        }
    }

    /* Points the source pane at the line a suggestion would change. Matching is
       done on folded text because the source is LaTeX-escaped — the bullet reads
       "cut costs by 40\%" there and "cut costs by 40%" in the suggestion, so a
       literal search would miss every line containing a special character. */
    const anchorTo = useCallback((suggestion) => {
        const needle = fold(
            suggestion.kind === "rewrite" && suggestion.currentText
                ? suggestion.currentText
                : parserView.content?.[suggestion.section]?.[suggestion.entryIndex]?.name
                  ?? parserView.content?.[suggestion.section]?.[suggestion.entryIndex]?.company
                  ?? ""
        ).slice(0, 40)

        if (!needle) return

        const found = sourceLines.findIndex((line) => fold(line).includes(needle))
        if (found === -1) return

        setHighlightLine(found)
        sourceRef.current
            ?.querySelector(`[data-line="${found}"]`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, [sourceLines, parserView.content])

    useEffect(() => { read() }, [read])
    useEffect(() => { analyse() }, [analyse])
    useEffect(() => { loadPreview() }, [loadPreview])

    useEffect(() => {
        if (status !== "loading") return
        const tl = riffle(riffleRef.current, READING_COURSES)
        return () => tl?.kill()
    }, [status])

    useEffect(() => {
        if (status !== "ready") return
        const a = snapStep(panelRef.current, { from: "18%", duration: 0.5 })
        return () => a?.kill()
    }, [status])

    if (status === "loading") {
        return (
            <main className="bench bench--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Reading your resume</p>
                    <p className="blind__course" ref={riffleRef}>RENDERING SOURCE</p>
                    <p className="blind__note">
                        The resume is compiled and its text layer read back — the same
                        stream an applicant tracking system receives.
                    </p>
                </div>
            </main>
        )
    }

    if (status === "fault") {
        return (
            <main className="bench bench--fault">
                <div className="blind blind--fault">
                    <p className="blind__rule">Service fault</p>
                    <p className="blind__course">OUT OF SERVICE</p>
                    <p className="blind__note">{fault}</p>
                    <div className="blind__actions">
                        <button className="act" onClick={retry}>Run again</button>
                        <Link className="act act--quiet" to={`/interview/${interviewId}`}>Back to the report</Link>
                    </div>
                </div>
            </main>
        )
    }

    const empty = parserView.text.trim().length === 0

    return (
        <main className="bench">
            <header className="bench__head">
                <Link className="bench__back" to={`/interview/${interviewId}`}>
                    ← Back to the report
                </Link>
                <div className="blind__window">
                    <span className="blind__code">ATS</span>
                    <h1 className="blind__course">RESUME BENCH</h1>
                </div>
                <p className="blind__note">
                    {parserView.name
                        ? `The tailored resume for ${parserView.name}, as a machine reads it.`
                        : "Your tailored resume, as a machine reads it."}
                </p>

                {/* Only once something has actually been changed. An undo control
                    on an untouched resume is noise, and "restore" with nothing to
                    restore invites the question of what it would undo. */}
                {parserView.edited && (
                    <div className="edited" role="status">
                        <span className="edited__mark">EDITED</span>
                        <span className="edited__note">
                            You are looking at your working copy. The generated resume is kept
                            untouched underneath it.
                        </span>
                        <div className="edited__acts">
                            <button type="button" className="act act--quiet" disabled={!canUndo || busy} onClick={undo}>
                                Undo last change
                            </button>
                            <button type="button" className="act act--quiet" disabled={busy} onClick={restoreGenerated}>
                                Restore the generated resume
                            </button>
                        </div>
                    </div>
                )}

                {draftFault && <p className="edited__fault" role="alert">{draftFault}</p>}
            </header>

            {/* The bench proper: the printed resume beside the source it came from. */}
            <section className="split">
                <div className="split__pane">
                    <p className="split__legend">
                        Printed
                        {/* Marked stale rather than cleared: the last good render
                            stays on screen through a failed compile, because losing
                            it over a stray brace helps nobody. */}
                        {compileError && <span className="split__stale">last good build</span>}
                    </p>
                    {previewStatus === "loading" && !compiledUrl && <p className="split__working">Compiling…</p>}
                    {previewStatus === "fault" && !compiledUrl && <p className="split__fault" role="alert">{previewFault}</p>}
                    {(compiledUrl || (previewStatus === "ready" && previewUrl)) && (
                        /* The browser's own PDF viewer. No pdf.js: it would add
                           roughly a megabyte to a bundle already flagged at 2MB,
                           to render a document the browser can already render. */
                        <iframe className="split__paper" src={compiledUrl || previewUrl} title="Compiled resume preview" />
                    )}
                </div>

                <div className="split__pane">
                    <p className="split__legend">
                        Source
                        <button
                            type="button"
                            className="split__mode"
                            onClick={() => setEditing((on) => !on)}>
                            {editing ? "Stop editing" : "Edit the LaTeX"}
                        </button>
                    </p>

                    {editing ? (
                        <>
                            <div className="split__editor">
                                <LatexEditor
                                    value={tex}
                                    onChange={setTexOverride}
                                    errorLine={compileError?.line ?? null}
                                />
                            </div>

                            <div className="split__acts">
                                <button
                                    type="button"
                                    className="act act--lead split__compile"
                                    disabled={compiling}
                                    onClick={handleCompile}>
                                    {compiling ? "Compiling…" : "Compile"}
                                </button>
                                {parserView.texEdited && (
                                    <button type="button" className="act act--quiet" disabled={compiling} onClick={handleRevertTex}>
                                        Back to the generated source
                                    </button>
                                )}
                            </div>

                            {compileError && (
                                <p className="split__error" role="alert">
                                    {compileError.line !== null
                                        ? <><strong>Line {compileError.line}</strong> — {compileError.message}</>
                                        : compileError.message}
                                </p>
                            )}
                        </>
                    ) : (
                        /* Read-only view, rendered line by line so a suggestion can
                           point at the exact line it would change. */
                        <pre className="split__source" ref={sourceRef}>
                            {sourceLines.map((line, n) => (
                                <span
                                    key={n}
                                    data-line={n}
                                    className={`split__line${n === highlightLine ? " is-struck" : ""}`}>
                                    {line || " "}
                                </span>
                            ))}
                        </pre>
                    )}
                </div>
            </section>

            {/* The reading: how the posting scores this resume. Arrives after the
                inspection below it, because this one costs a model call and the
                provable findings should not wait behind it. */}
            <section className="reading">
                <h2 className="reading__rule">Against the posting</h2>

                {atsStatus === "loading" && (
                    <p className="reading__working" aria-live="polite">Reading the posting against your resume…</p>
                )}

                {atsStatus === "fault" && (
                    <p className="reading__fault" role="alert">
                        {atsFault}{" "}
                        <button type="button" className="reading__again" onClick={atsRetry}>Try again</button>
                    </p>
                )}

                {atsStatus === "ready" && (
                    <>
                        <p className="reading__score">
                            <span className="reading__value">{analysis.score ?? "—"}</span>
                            {analysis.score !== null && <span className="reading__pct">%</span>}
                            {/* The delta, never a replacement. The report's own score
                                stays what it was when the report was generated. */}
                            {analysis.baseline !== null && analysis.score !== null && (
                                <span className="reading__delta">
                                    report read {analysis.baseline}%
                                    {analysis.score !== analysis.baseline && (
                                        <> · {analysis.score > analysis.baseline ? "+" : ""}{analysis.score - analysis.baseline}</>
                                    )}
                                </span>
                            )}
                        </p>

                        {REQUIREMENT_GROUPS.map(({ status: group, legend, note }) => {
                            const terms = analysis.keywords.filter((k) => k.status === group)
                            if (terms.length === 0) return null
                            return (
                                <div key={group} className={`wants wants--${group}`}>
                                    <p className="wants__legend">
                                        {legend} <span className="wants__count">{terms.length}</span>
                                    </p>
                                    <p className="wants__note">{note}</p>
                                    <ul className="wants__rank">
                                        {terms.map((k) => (
                                            <li key={k.term} className="want">
                                                <span className="want__term">{k.term}</span>
                                                <span className="want__note">{k.note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        })}
                    </>
                )}
            </section>

            {/* The work: proposed bullets, each grounded in the candidate's own
                source material. Nothing here may claim experience the source does
                not show — where a figure is unknowable it arrives as a blank. */}
            {atsStatus === "ready" && analysis.suggestions.length > 0 && (
                <section className="work">
                    <h2 className="work__rule">Worth changing</h2>
                    <p className="work__note">
                        Drawn only from your own resume and what you wrote about yourself —
                        never from the posting. A <code>___</code> is a number only you know;
                        fill it in rather than guessing.
                    </p>

                    <ul className="work__rank">
                        {analysis.suggestions.map((s, i) => (
                            <li key={`${s.section}-${s.entryIndex}-${s.bulletIndex}-${i}`} className="fix">
                                <p className="fix__legend">
                                    <span className="fix__kind">{s.kind === "rewrite" ? "REWRITE" : "ADD"}</span>
                                    {s.addresses?.length > 0 && (
                                        <span className="fix__for">for {s.addresses.join(", ")}</span>
                                    )}
                                    {s.needsInput && <span className="fix__blank">needs a figure</span>}
                                </p>

                                {s.currentText && <p className="fix__was">{s.currentText}</p>}

                                {/* A bullet carrying ___ is not finished text. It is
                                    made editable rather than applyable, so the blank
                                    has to be answered by the person who knows the
                                    number instead of being published unfilled. */}
                                {s.needsInput ? (
                                    <textarea
                                        className="fix__edit"
                                        aria-label="Fill in the blank before applying"
                                        value={drafted[i] ?? s.proposedText}
                                        onChange={(e) => setDrafted((d) => ({ ...d, [i]: e.target.value }))}
                                    />
                                ) : (
                                    <p className="fix__now">{s.proposedText}</p>
                                )}

                                <p className="fix__why">{s.why}</p>

                                <div className="fix__acts">
                                    <button
                                        type="button"
                                        className="fix__find"
                                        onClick={() => anchorTo(s)}>
                                        Show me where
                                    </button>
                                    <button
                                        type="button"
                                        className="act act--quiet fix__apply"
                                        disabled={busy || (s.needsInput && (drafted[i] ?? s.proposedText).includes("___"))}
                                        onClick={() => applySuggestion(parserView.content, s, drafted[i] ?? s.proposedText)}>
                                        {busy ? "Working…" : s.kind === "rewrite" ? "Replace the bullet" : "Add the bullet"}
                                    </button>
                                    {s.needsInput && (drafted[i] ?? s.proposedText).includes("___") && (
                                        <span className="fix__hold">Fill in the blank to apply</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Gaps in the candidate, not in the document. Deliberately kept apart
                from the suggestions above and given no action: the honest answer to
                "the posting wants Kubernetes" is not to quietly add the word. */}
            {atsStatus === "ready" && analysis.untrueSkills.length > 0 && (
                <section className="honest">
                    <h2 className="honest__rule">Asked for, and not yours to claim</h2>
                    <p className="honest__note">
                        The posting asks for these and nothing in your material shows them.
                        Add them only if they are genuinely true of you — a resume that claims
                        them is a resume you have to defend in the interview.
                    </p>
                    <ul className="honest__rank">
                        {analysis.untrueSkills.map((skill) => (
                            <li key={skill.term} className="honest__item">
                                <span className="honest__term">{skill.term}</span>
                                <span className="honest__body">{skill.note}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* The inspection: provable faults only. Every line here is a
                deterministic check, so it states facts rather than opinions. */}
            {parserView.checks.length > 0 && (
                <section className="inspect" ref={panelRef}>
                    <h2 className="inspect__rule">Inspection</h2>
                    <ul className="inspect__rank">
                        {parserView.checks.map((check) => (
                            <li key={check.id} className={`inspect__item inspect__item--${check.status}`}>
                                {/* The word, not just the colour — a red dot alone
                                    is invisible to a colour-blind reader and to a
                                    screen reader alike. */}
                                <span className="inspect__mark">{STATUS_WORD[check.status] ?? check.status}</span>
                                <span className="inspect__body">
                                    <span className="inspect__legend">{check.label}</span>
                                    <span className="inspect__note">{check.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="tape-read">
                <h2 className="tape-read__rule">What the parser sees</h2>
                <p className="tape-read__note">
                    {empty
                        ? "No text could be read from the compiled resume. An applicant tracking system would find nothing to parse — which is the worst possible outcome, and worth investigating before you send it anywhere."
                        : "This is the text layer lifted out of your compiled PDF, in the order a parser receives it. If something reads out of order here, it reads out of order to them."}
                </p>

                {!empty && (
                    <button
                        type="button"
                        className="tape-read__toggle"
                        aria-expanded={streamOpen}
                        onClick={() => setStreamOpen((open) => !open)}>
                        {streamOpen ? "Hide the parser's view" : "Show the parser's view"}
                        <ChevronRightIcon />
                    </button>
                )}

                {streamOpen && !empty && (
                    <pre className="tape-read__stream">{parserView.text}</pre>
                )}
            </section>
        </main>
    )
}

export default ResumeWorkbench
