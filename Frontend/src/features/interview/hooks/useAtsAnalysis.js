import { useCallback, useState } from "react"
import { fetchResumeAtsAnalysis } from "../services/interview.api"

/**
 * Scores the resume against the posting and classifies its requirements.
 *
 * Deliberately separate from useParserView: the parser view and the mechanical
 * checks are fast and free, while this is a model call. Kept apart, the page can
 * render the provable findings immediately and let the scored ones arrive after,
 * instead of holding everything behind the slowest thing on the page.
 */
export function useAtsAnalysis(interviewId) {
    const [status, setStatus] = useState("loading")
    const [analysis, setAnalysis] = useState({
        score: null, baseline: null, keywords: [], suggestions: [], untrueSkills: [],
    })
    const [fault, setFault] = useState("")

    const analyse = useCallback(async () => {
        try {
            const data = await fetchResumeAtsAnalysis(interviewId)
            setAnalysis({
                // null, not 0 — "not scored" and "scored zero" are different
                // answers and must not render as the same thing.
                score: typeof data.score === "number" ? data.score : null,
                baseline: typeof data.baseline === "number" ? data.baseline : null,
                keywords: Array.isArray(data.keywords) ? data.keywords : [],
                suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
                untrueSkills: Array.isArray(data.untrueSkills) ? data.untrueSkills : [],
            })
            setStatus("ready")
        } catch (err) {
            setFault(err?.response?.data?.message
                || "The posting could not be read against your resume. Try again in a moment.")
            setStatus("fault")
        }
    }, [interviewId])

    const retry = useCallback(() => {
        setStatus("loading")
        setFault("")
        analyse()
    }, [analyse])

    return { status, analysis, fault, analyse, retry }
}
