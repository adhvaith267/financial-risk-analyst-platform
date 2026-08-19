// Diverging blue (positive) <-> red (negative) with a neutral midpoint at 0,
// per the dataviz diverging-pair convention. Text stays on ink tokens, never
// the fill color, so labels are always readable regardless of cell shade.
function cellColor(value) {
  const clamped = Math.max(-1, Math.min(1, value))
  if (Math.abs(clamped) < 0.05) return 'var(--surface-sunken)'
  const alpha = 0.12 + Math.abs(clamped) * 0.55
  const rgb = clamped > 0 ? '42, 120, 214' : '208, 59, 59'
  return `rgba(${rgb}, ${alpha})`
}

export default function CorrelationMatrix({ matrix }) {
  const assets = Object.keys(matrix)
  if (assets.length === 0) return null

  return (
    <div className="corr-matrix-wrap">
      <table className="corr-matrix">
        <thead>
          <tr>
            <th />
            {assets.map((a) => (
              <th key={a}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((row) => (
            <tr key={row}>
              <th>{row}</th>
              {assets.map((col) => {
                const value = matrix[row]?.[col] ?? 0
                return (
                  <td key={col} style={{ background: cellColor(value) }} title={`${row} × ${col}: ${value}`}>
                    {value.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
