/**
 * @description Triggers a browser "Save As" for a blob via a throwaway
 * anchor element — the standard client-side download pattern. Deferring the
 * revoke to the next macrotask (rather than calling it immediately after
 * click()) avoids a known Safari quirk where revoking too early can cancel
 * the download.
 */
export function downloadBlob(blob, filename) {
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 0)
}
