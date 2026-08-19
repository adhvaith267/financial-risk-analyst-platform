// Plain inline SVG line chart - no charting library. 2px line, ~10% opacity
// area wash, hairline baseline, per the platform's mark specs.
export default function LineChart({ data }) {
  if (!data || data.length < 2) return null

  const width = 640
  const height = 180
  const padding = 10
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (d.value - min) / span) * (height - padding * 2)
    return [x, y]
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - padding} L${points[0][0]},${height - padding} Z`

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" preserveAspectRatio="none">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="line-chart-baseline"
        />
        <path d={areaPath} className="line-chart-area" />
        <path d={linePath} className="line-chart-line" />
      </svg>
      <div className="line-chart-labels">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}
