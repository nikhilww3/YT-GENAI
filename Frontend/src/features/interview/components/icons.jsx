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

export const ChevronDownIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="16" height="16">
        <path d="m6 9 6 6 6-6" />
    </svg>
)

export const CheckIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="16" height="16">
        <path d="m5 12 5 5 9-9" />
    </svg>
)

export const DownloadIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
    </svg>
)

export const CodeIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="m8 6-5 6 5 6" />
        <path d="m16 6 5 6-5 6" />
    </svg>
)

/* The ZeroFare mark: one split-flap character showing "0" — the same
   flap-tile shape the riffle() animation (lib/animations/blind.js) simulates
   turning over, just held still. Filled brand colors, not currentColor —
   this is a fixed mark, not a UI icon that inherits surrounding text color.
   Relies on --legend/--ink being in scope (true everywhere it's used: inside
   .depot, .report, or .ticket, all of which include the app-theme mixin). */
export const EyeIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

export const EyeOffIcon = ({ className }) => (
    <svg {...baseProps} className={className} width="18" height="18">
        <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a18.4 18.4 0 0 1-2.9 3.9M6.5 6.6A18.3 18.3 0 0 0 2 12s3.6 7 10 7a10.3 10.3 0 0 0 4.4-.95" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        <path d="m3 3 18 18" />
    </svg>
)

export const ZeroFareMark = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={className}
        width="28"
        height="28"
        role="img"
        aria-label="ZeroFare"
    >
        <rect x="1" y="1" width="22" height="22" rx="3" fill="var(--legend, #F5C518)" />
        <rect x="7" y="5" width="10" height="14" rx="5" fill="var(--ink, #12140F)" />
        <rect x="9.4" y="7.4" width="5.2" height="9.2" rx="2.6" fill="var(--legend, #F5C518)" />
        <rect x="1" y="11.3" width="22" height="1.4" fill="var(--ink, #12140F)" opacity="0.45" />
    </svg>
)
