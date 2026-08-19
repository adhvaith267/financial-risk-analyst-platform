import useCountUp from '../hooks/useCountUp.js'

/** A single metric tile. Pass `numericValue` + `formatter` for an animated
 * count-up (dashboard KPIs); pass a plain `value` for everything else. */
export default function Stat({ label, value, numericValue, formatter, tone, delay = 0 }) {
  const animated = useCountUp(numericValue)
  const displayValue = numericValue !== undefined && formatter ? formatter(animated) : value

  return (
    <div className={'stat fade-in' + (tone ? ` stat-${tone}` : '')} style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{displayValue}</div>
    </div>
  )
}
