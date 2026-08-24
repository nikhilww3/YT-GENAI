import { useCallback, useState } from "react"
import { saveResumeDraft, discardResumeDraft } from "../services/interview.api"

/**
 * Owns edits to the tailored resume: applying a suggestion, undoing one, and
 * restoring the generated original.
 *
 * History is a stack of whole documents rather than a list of reverse-patches.
 * A resume is small, and snapshots make undo exact — a patch-based stack has to
 * be right about every field it did not touch, and is wrong in ways that only
 * show up after several edits, which is the worst time to discover it.
 *
 * Deliberately NOT persisted: the working copy survives a refresh, the undo
 * stack does not. "Restore the generated resume" is the durable escape hatch,
 * and persisting a full history is a lot of storage for a rarely-used path.
 */
export function useResumeDraft(interviewId, { onChanged }) {
    const [history, setHistory] = useState([])
    const [busy, setBusy] = useState(false)
    const [fault, setFault] = useState("")

    const commit = useCallback(async (content, { remember }) => {
        setBusy(true)
        setFault("")
        try {
            await saveResumeDraft(interviewId, content)
            if (remember) setHistory((stack) => [...stack, remember])
            await onChanged?.()
            return true
        } catch (err) {
            setFault(err?.response?.data?.message || "That change could not be saved. Try again.")
            return false
        } finally {
            setBusy(false)
        }
    }, [interviewId, onChanged])

    /* The proposed text is already written by the suggestion pass, so applying it
       is a local edit and a save — no second model call, nothing to wait for, and
       the result is exactly the text the user just read and approved. */
    const applySuggestion = useCallback(async (content, suggestion, text) => {
        const next = structuredClone(content)
        const list = next[suggestion.section]?.[suggestion.entryIndex]?.bullets

        if (!Array.isArray(list)) {
            setFault("That suggestion no longer matches your resume — reload and try again.")
            return false
        }

        if (suggestion.kind === "rewrite" && suggestion.bulletIndex >= 0) {
            list[suggestion.bulletIndex] = text
        } else {
            list.push(text)
        }

        return commit(next, { remember: content })
    }, [commit])

    const undo = useCallback(async () => {
        if (history.length === 0) return false
        const previous = history[history.length - 1]
        setHistory((stack) => stack.slice(0, -1))
        return commit(previous, { remember: null })
    }, [history, commit])

    const restoreGenerated = useCallback(async () => {
        setBusy(true)
        setFault("")
        try {
            await discardResumeDraft(interviewId)
            setHistory([])
            await onChanged?.()
            return true
        } catch (err) {
            setFault(err?.response?.data?.message || "The generated resume could not be restored. Try again.")
            return false
        } finally {
            setBusy(false)
        }
    }, [interviewId, onChanged])

    return { applySuggestion, undo, restoreGenerated, canUndo: history.length > 0, busy, fault }
}
