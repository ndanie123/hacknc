export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Log Companion">
      <svg
        className={compact ? "brand-mark brand-mark--compact" : "brand-mark"}
        viewBox="0 0 52 52"
        role="img"
        aria-hidden="true"
      >
        <rect x="12" y="4" width="34" height="42" rx="8" fill="#8B7CF8" />
        <path d="M37 4h6.5v10l-3.25-2.6L37 14V4Z" fill="#4FB3F6" />
        <rect x="6.5" y="13" width="7" height="3.4" rx="1.7" fill="#221D4A" />
        <rect x="6.5" y="23.3" width="7" height="3.4" rx="1.7" fill="#221D4A" />
        <rect x="6.5" y="33.6" width="7" height="3.4" rx="1.7" fill="#221D4A" />
        <circle cx="24.5" cy="22" r="2" fill="#221D4A" />
        <circle cx="33.5" cy="22" r="2" fill="#221D4A" />
        <circle cx="20.8" cy="27" r="2" fill="#F7B6CC" />
        <circle cx="37.2" cy="27" r="2" fill="#F7B6CC" />
        <path
          d="M23.5 27.2c3.3 3 7.7 3 11 0"
          fill="none"
          stroke="#221D4A"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </svg>
    </div>
  );
}
