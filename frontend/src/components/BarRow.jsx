export default function BarRow({ items, formatValue }) {
  const maxValue = Math.max(...items.map((i) => i.value), 0.0001)

  return (
    <div className="bar-rows">
      {items.map((item) => {
        const pct = Math.max((item.value / maxValue) * 100, 2)
        return (
          <div className="bar-row" key={item.label}>
            <div className="bar-row-label">{item.label}</div>
            <div className="bar-row-track">
              <div
                className="bar-row-fill"
                style={{ width: `${pct}%`, background: item.color }}
                title={`${item.label}: ${formatValue(item.value)}`}
              />
            </div>
            <div className="bar-row-value">{formatValue(item.value)}</div>
          </div>
        )
      })}
    </div>
  )
}
