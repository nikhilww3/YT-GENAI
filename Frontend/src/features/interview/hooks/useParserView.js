import { useCallback, useState } from "react"
import { fetchResumeParserView } from "../services/interview.api"

/**
 * Loads the tailored resume's text layer — the stream a PDF parser receives.
 *
 * The fetching state lives here rather than in the page for the same reason
 * useInterview does: a component whose own effect calls its own setState is
 * flagged as a cascading render, and the established shape in this codebase is
 * that the hook owns the state and the page just calls into it.
 *
 * `status` is an explicit string, never a bare boolean. "loading" and "ready but
 * empty" are genuinely different answers — an empty text layer means a parser
 * would read nothing at all, which is a finding, not an absence of one.
 */
export function useParserView(interviewId) {
    const [status, setStatus] = useState("loading")
    const [parserView, setParserView] = useState({
        name: "", text: "", checks: [], content: null, tex: "", edited: false, texEdited: false,
    })
    const [fault, setFault] = useState("")

    const read = useCallback(async () => {
        try {
            const data = await fetchResumeParserView(interviewId)
            setParserView({
                name: data.name ?? "",
                text: data.text ?? "",
                // Defaulted to [] rather than left undefined: the page maps over
                // this, and "no checks came back" must render as nothing rather
                // than throw.
                checks: Array.isArray(data.checks) ? data.checks : [],
                content: data.content ?? null,
                tex: data.tex ?? "",
                edited: Boolean(data.edited),
                texEdited: Boolean(data.texEdited),
            })
            setStatus("ready")
        } catch (err) {
            // The backend answers with a real reason (404 for a report that is
            // not yours, 429 when rate limited, 500 when the compile fails).
            // Only claim a connection problem when there is genuinely no response.
            setFault(err?.response?.data?.message
                || "Could not reach the depot. Check your connection and try again.")
            setStatus("fault")
        }
    }, [interviewId])

    const retry = useCallback(() => {
        setStatus("loading")
        setFault("")
        read()
    }, [read])

    return { status, parserView, fault, read, retry }
}
