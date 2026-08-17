// Presentational-only inline SVG icons for the interview feature.
// Kept local so the UI layer has no external icon dependency.

const baseProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
}

export const BriefcaseIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="20" height="20">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
)

export const UserIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="20" height="20">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
)

export const UploadCloudIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="34" height="34">
        <path d="M17 17.5a4.5 4.5 0 0 0-1.2-8.84 6 6 0 0 0-11.5 2.1A3.75 3.75 0 0 0 5 17.5" />
        <path d="M12 21V11" />
        <path d="m8.5 14.5 3.5-3.5 3.5 3.5" />
    </svg>
)

export const InfoIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
    </svg>
)

export const SparkIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18" fill="currentColor" stroke="none">
        <path d="m12 3 2.2 5.6L20 10.8l-5.8 2.2L12 19l-2.2-6L4 10.8l5.8-2.2L12 3Z" />
    </svg>
)

export const ChevronRightIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="m9 6 6 6-6 6" />
    </svg>
)

export const DownloadIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
    </svg>
)
