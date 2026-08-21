const BARS = [38, 62, 47, 78, 55, 88, 44, 70, 34, 60];

/**
 * Hero instrument: portfolio health indicator and a low-to-high exposure distribution.
 */
export function SignalVisual() {
  return (
    <figure className="relative w-full rounded-xl border border-hairline bg-forest p-6 sm:p-8">
      <figcaption className="mb-6 flex items-baseline justify-between gap-4">
        <span className="eyebrow">Riskora live signal</span>
        <span className="num text-[11px] text-muted-foreground">REALTIME</span>
      </figcaption>

      <div className="space-y-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Portfolio health
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-forest-raised">
            <div className="h-full w-[68%] rounded-full bg-lime" />
          </div>
          <p className="num mt-2 text-xs text-muted-foreground">Stable · monitoring 4 signals</p>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Risk distribution
          </p>
          <div className="mt-3 flex h-24 items-end gap-2" aria-hidden="true">
            {BARS.map((h, i) => (
              <span
                key={i}
                className="flex-1 origin-bottom rounded-[2px]"
                style={{
                  height: `${h}%`,
                  background: i > 6 ? "var(--lime)" : "var(--signal)",
                  opacity: 0.35 + i * 0.06,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
