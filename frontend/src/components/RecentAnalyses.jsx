import { Link } from 'react-router-dom'
import { formatRelativeTime } from '../format.js'

const RISK_TYPE_ROUTE = { credit: '/credit', market: '/market', stress: '/stress' }
const RISK_TYPE_LABEL = { credit: 'Credit Risk', market: 'Market Risk', stress: 'Stress Test' }

export default function RecentAnalyses({ analyses }) {
  if (!analyses || analyses.length === 0) {
    return <p className="empty-state">No analyses run yet — try Credit Risk, Market Risk, or Stress Testing.</p>
  }

  return (
    <table className="data-table recent-analyses-table">
      <thead>
        <tr>
          <th>Entity</th>
          <th>Type</th>
          <th>Result</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        {analyses.map((a, i) => (
          <tr key={i} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <td>{a.entity_id}</td>
            <td>
              <Link to={RISK_TYPE_ROUTE[a.risk_type] || '/'}>{RISK_TYPE_LABEL[a.risk_type] || a.risk_type}</Link>
            </td>
            <td>
              <span className={'result-badge result-' + (a.label === 'DECLINED' ? 'bad' : 'neutral')}>
                {a.label}
              </span>
            </td>
            <td className="meta-row">{formatRelativeTime(a.computed_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
