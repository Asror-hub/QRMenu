export function BrandMark({ className = "" }) {
  return (
    <svg
      className={`brand__mark${className ? ` ${className}` : ""}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <g className="brand__mark-finders">
        <rect x="5" y="5" width="9" height="9" rx="1.35" fill="#fff" />
        <rect x="6.55" y="6.55" width="5.9" height="5.9" rx="0.7" fill="currentColor" />
        <rect x="8.05" y="8.05" width="2.9" height="2.9" rx="0.4" fill="#2B6CFF" />

        <rect x="18" y="5" width="9" height="9" rx="1.35" fill="#fff" />
        <rect x="19.55" y="6.55" width="5.9" height="5.9" rx="0.7" fill="currentColor" />
        <rect x="21.05" y="8.05" width="2.9" height="2.9" rx="0.4" fill="#2B6CFF" />

        <rect x="5" y="18" width="9" height="9" rx="1.35" fill="#fff" />
        <rect x="6.55" y="19.55" width="5.9" height="5.9" rx="0.7" fill="currentColor" />
        <rect x="8.05" y="21.05" width="2.9" height="2.9" rx="0.4" fill="#2B6CFF" />
      </g>
      <g fill="#fff">
        <rect x="18.15" y="18.15" width="2.35" height="2.35" rx="0.4" />
        <rect x="21.55" y="18.15" width="2.35" height="2.35" rx="0.4" />
        <rect x="24.95" y="18.15" width="2.35" height="2.35" rx="0.4" />
        <rect x="18.15" y="21.55" width="2.35" height="2.35" rx="0.4" />
        <rect x="24.95" y="21.55" width="2.35" height="2.35" rx="0.4" />
        <rect x="18.15" y="24.95" width="2.35" height="2.35" rx="0.4" />
        <rect x="21.55" y="24.95" width="2.35" height="2.35" rx="0.4" />
      </g>
      <rect x="5" y="15.25" width="22" height="1.55" rx="0.75" fill="#2B6CFF" />
    </svg>
  );
}

export function BrandWordmark() {
  return (
    <span className="brand__wordmark">
      Smart<span className="brand__qr">Qr</span>
    </span>
  );
}
