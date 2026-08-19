export default function Stat({ label, value, tone }) {
  return (
    <div className={'stat' + (tone ? ` stat-${tone}` : '')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
