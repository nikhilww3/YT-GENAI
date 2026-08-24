import { useCallback, useEffect, useRef, useState } from "react"
import { compileResumeLatex, discardResumeTex } from "../services/interview.api"

/**
 * Compiles hand-edited LaTeX and owns the resulting preview URL.
 *
 * The rule that shapes this: a failed compile must NOT clear the preview. Losing
 * the last good render because of a stray brace is punishing — the user needs to
 * see what they had while they fix what they broke. So `url` is only ever replaced
 * on success, and failure sets `error` alongside it.
 *
 * Same object-URL discipline as useResumePreview: the previous URL is revoked when
 * a new one replaces it, and the last one on unmount, or every compile would leave
 * another whole PDF resident for the life of the tab.
 */
export function useLatexCompile(interviewId) {
    const [url, setUrl] = useState(null)
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)
    const urlRef = useRef(null)

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }, [])

    const compile = useCallback(async (tex) => {
        setBusy(true)
        setError(null)
        try {
            const blob = await compileResumeLatex(interviewId, tex)
            if (urlRef.current) URL.revokeObjectURL(urlRef.current)
            urlRef.current = URL.createObjectURL(blob)
            setUrl(urlRef.current)
            return true
        } catch (err) {
            setError({
                message: err?.latex?.message || err?.message || "The document did not compile",
                // null when TeX did not say which line — the UI must not pretend
                // to know, and marking line 1 by default would be a lie.
                line: err?.latex?.line ?? null,
                raw: err?.latex?.raw ?? "",
            })
            return false
        } finally {
            setBusy(false)
        }
    }, [interviewId])

    const revert = useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
            await discardResumeTex(interviewId)
            return true
        } catch (err) {
            setError({ message: err?.response?.data?.message || "Could not revert the source.", line: null, raw: "" })
            return false
        } finally {
            setBusy(false)
        }
    }, [interviewId])

    return { compile, revert, url, error, busy }
}
