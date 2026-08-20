export default function Dumbbell({ rows, formatValue }) {
  const allValues = rows.flatMap((r) => [r.baseline, r.stressed])
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const span = max - min || 1
  const pad = span * 0.12
  const domainMin = min - pad
  const domainMax = max + pad

  const toPct = (v) => ((v - domainMin) / (domainMax - domainMin)) * 100

  return (
    <div className="dumbbell">
      <div className="dumbbell-legend">
        <span className="legend-swatch">
          <span className="legend-dot" style={{ background: 'var(--text-muted)' }} /> Baseline
        </span>
        <span className="legend-swatch">
          <span className="legend-dot" style={{ background: 'var(--series-2)' }} /> Stressed
        </span>
      </div>
      {rows.map((row) => {
        const p1 = toPct(row.baseline)
        const p2 = toPct(row.stressed)
        const left = Math.min(p1, p2)
        const width = Math.abs(p2 - p1)
        return (
          <div key={row.label}>
            <div className="bar-row-label" style={{ marginBottom: 4 }}>
              {row.label}
            </div>
            <div className="dumbbell-row">
              <div className="dumbbell-track" />
              <div className="dumbbell-connector" style={{ left: `${left}%`, width: `${width}%` }} />
              <div
                className="dumbbell-dot baseline"
                style={{ left: `${p1}%` }}
                title={`Baseline: ${formatValue(row.baseline)}`}
              />
              <div
                className="dumbbell-dot stressed"
                style={{ left: `${p2}%` }}
                title={`Stressed: ${formatValue(row.stressed)}`}
              />
            </div>
            <div className="meta-row">
              Baseline vs stressed: {formatValue(row.baseline)} / {formatValue(row.stressed)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
