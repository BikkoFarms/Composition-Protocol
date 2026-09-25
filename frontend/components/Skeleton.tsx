export function Skeleton({
  height = 16,
  width = "100%",
  className = "",
}: {
  height?: number | string;
  width?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ height, width }}
      aria-hidden
    />
  );
}

export function SkeletonBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 22 : 14} width={`${92 - i * 8}%`} />
      ))}
    </div>
  );
}
