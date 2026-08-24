import { useCallback, useEffect, useRef, useState } from "react"
import { fetchResumePreview } from "../services/interview.api"

/**
 * Holds the object URL for the compiled resume shown in the preview pane.
 *
 * The lifecycle is the whole point of this hook. `URL.createObjectURL` pins the
 * blob in memory until it is explicitly revoked — the browser will not collect it
 * just because nothing references the URL any more. Editing a resume recompiles
 * it repeatedly, so without revoking, every compile would leave another whole PDF
 * resident for the life of the tab.
 *
 * So: the previous URL is revoked whenever a new one replaces it, and the last one
 * is revoked on unmount. The ref exists because the cleanup needs the current URL
 * without re-running the effect (and re-fetching) every time it changes.
 */
export function useResumePreview(interviewId) {
    const [url, setUrl] = useState(null)
    const [status, setStatus] = useState("loading")
    const [fault, setFault] = useState("")
    const urlRef = useRef(null)

    const swap = useCallback((next) => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = next
        setUrl(next)
    }, [])

    const load = useCallback(async () => {
        try {
            const blob = await fetchResumePreview(interviewId)
            swap(URL.createObjectURL(blob))
            setStatus("ready")
        } catch (err) {
            // responseType "blob" applies to error bodies too, so the backend's
            // JSON message arrives as a Blob rather than parsed JSON.
            let message = ""
            if (err?.response?.data instanceof Blob) {
                try { message = JSON.parse(await err.response.data.text()).message } catch { /* not JSON */ }
            }
            setFault(message || "The resume preview could not be rendered.")
            setStatus("fault")
        }
    }, [interviewId, swap])

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }, [])

    const reload = useCallback(() => {
        setStatus("loading")
        setFault("")
        load()
    }, [load])

    return { url, status, fault, load, reload }
}
