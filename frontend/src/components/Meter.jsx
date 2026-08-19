export default function Meter({ value, max, threshold, valueLabel, thresholdLabel }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100
  const thresholdPct = Math.min(Math.max(threshold / max, 0), 1) * 100

  let fillColor = 'var(--status-good)'
  if (value >= threshold) fillColor = 'var(--status-critical)'
  else if (value >= threshold * 0.5) fillColor = 'var(--status-warning)'

  return (
    <div className="meter">
      <div className="meter-value-row">
        <span className="meter-value" style={{ color: fillColor }}>
          {valueLabel}
        </span>
        <span className="meter-threshold-label">{thresholdLabel}</span>
      </div>
      <div className="meter-track" title={`${valueLabel} of ${thresholdLabel}`}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: fillColor }} />
        <div className="meter-threshold-tick" style={{ left: `${thresholdPct}%` }} />
      </div>
    </div>
  )
}
