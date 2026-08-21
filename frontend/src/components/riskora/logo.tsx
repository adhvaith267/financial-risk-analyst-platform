export function RiskoraMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeOpacity="0.55" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      <path d="M16 1.5 V 8" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M24 24 L 30.5 30.5" stroke="currentColor" strokeOpacity="0.5" />
    </svg>
  );
}

export function RiskoraLogo({
  className = "",
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <RiskoraMark className="h-6 w-6 text-lime" />
      <span className="leading-none">
        <span className="block font-display text-xl tracking-tight text-foreground">Riskora</span>
        {subtitle ? (
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
