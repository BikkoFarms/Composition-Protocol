/**
 * Settleflow mark — seal geometry with interlocking SF (Settleflow).
 */
export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = "sf-seal";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Settleflow"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-ring`} x1="4" y1="4" x2="44" y2="44">
          <stop stopColor="#7a2251" />
          <stop offset="0.28" stopColor="#a36a14" />
          <stop offset="0.52" stopColor="#2a4e1c" />
          <stop offset="0.74" stopColor="#003d3d" />
          <stop offset="1" stopColor="#652ea3" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="12" y1="10" x2="36" y2="38">
          <stop stopColor="#e4f7f9" />
          <stop offset="0.55" stopColor="#f8fbe7" />
          <stop offset="1" stopColor="#e1e1fa" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill={`url(#${id}-ring)`}
      />
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="9"
        fill={`url(#${id}-face)`}
      />
      {/* Flow rails — three settlement legs */}
      <path
        d="M14 18h20M14 24h20M14 30h20"
        stroke="#001f1f"
        strokeWidth="1.2"
        strokeOpacity="0.18"
        strokeLinecap="round"
      />
      <path
        d="M18 14v20M24 14v20M30 14v20"
        stroke="#001f1f"
        strokeWidth="1.2"
        strokeOpacity="0.12"
        strokeLinecap="round"
      />
      {/* S */}
      <path
        d="M21.2 19.2c0-1.8 1.4-2.9 3.6-2.9 1.4 0 2.5.4 3.4 1.1l-1.2 1.6c-.6-.4-1.3-.7-2.2-.7-1.1 0-1.7.5-1.7 1.1 0 .7.4 1 2.2 1.5 2.4.7 4 1.6 4 3.8 0 2.1-1.6 3.4-4.2 3.4-1.7 0-3.1-.5-4.1-1.4l1.3-1.6c.7.6 1.7 1 2.8 1 1.3 0 2-.6 2-1.3 0-.7-.5-1.1-2.4-1.6-2.4-.7-3.8-1.7-3.8-3.9Z"
        fill="#001f1f"
      />
      {/* F */}
      <path
        d="M28.4 16.5h7.2v2.4h-4.4v3.2h3.8v2.3h-3.8v6.1h-2.8V16.5Z"
        fill="#003d3d"
      />
      <circle cx="38" cy="12" r="2.2" fill="#a36a14" />
    </svg>
  );
}
