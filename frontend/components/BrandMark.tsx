/**
 * CP seal — traditional finance crest geometry with colorful composition lattice.
 * Not a generic "Africa" mark: bank seal + multi-asset color bands.
 */
export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = "cp-seal";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
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
      {/* Lattice rails — composition of three settlement legs */}
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
      {/* C */}
      <path
        d="M22.5 16.2c-4.2 0-7.1 2.9-7.1 7.8s2.9 7.8 7.1 7.8c2.1 0 3.8-.7 5.1-1.9l-1.5-1.7c-.9.8-2 1.3-3.5 1.3-2.7 0-4.5-1.9-4.5-5.5s1.8-5.5 4.5-5.5c1.5 0 2.6.5 3.5 1.3l1.5-1.7c-1.3-1.2-3-1.9-5.1-1.9Z"
        fill="#001f1f"
      />
      {/* P interlocking */}
      <path
        d="M25.2 16.5h5.2c3.2 0 5.3 1.8 5.3 4.7 0 2.8-2 4.5-4.9 4.5h-2.8v6.8h-2.8V16.5Zm2.8 6.6h2.2c1.5 0 2.4-.8 2.4-2 0-1.2-.9-2-2.4-2h-2.2v4Z"
        fill="#003d3d"
      />
      <circle cx="38" cy="12" r="2.2" fill="#a36a14" />
    </svg>
  );
}
