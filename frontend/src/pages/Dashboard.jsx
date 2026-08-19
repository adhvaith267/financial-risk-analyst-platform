import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import BarRow from '../components/BarRow.jsx'
import RecentAnalyses from '../components/RecentAnalyses.jsx'
import { CreditIcon, MarketIcon, StressIcon, AgentIcon } from '../icons.jsx'
import { formatPercent, formatCurrency, formatCompactCurrency } from '../format.js'

const EXPLORE_PANELS = [
  { to: '/credit', title: 'Credit Risk', Icon: CreditIcon, body: 'Investigate an individual borrower.' },
  { to: '/market', title: 'Market Risk', Icon: MarketIcon, body: "Inspect a portfolio's current risk." },
  { to: '/stress', title: 'Stress Testing', Icon: StressIcon, body: 'Run a shock scenario.' },
  { to: '/agent', title: 'AI Analyst', Icon: AgentIcon, body: 'Ask a question in plain language.' },
]

const DRIVER_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  const driverItems = (summary?.top_risk_drivers || []).map((d, i) => ({
    label: d.driver,
    value: d.count,
    color: DRIVER_COLORS[i % DRIVER_COLORS.length],
  }))

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="AI-powered financial risk analysis: deterministic engines compute the numbers, the agent explains them."
      />

      {error && <div className="error-banner">Could not load summary: {error}</div>}

      {summary && (
        <>
          <div className="kpi-row kpi-row-hero">
            <Stat
              label="Portfolio Value"
              numericValue={summary.total_portfolio_value}
              formatter={formatCompactCurrency}
              delay={0}
            />
            <Stat
              label="Total Exposure"
              numericValue={summary.total_exposure}
              formatter={formatCompactCurrency}
              delay={60}
            />
            <Stat
              label="High-Risk Borrowers"
              numericValue={summary.high_risk_borrower_count}
              formatter={(v) => Math.round(v).toString()}
              tone={summary.high_risk_borrower_count > 0 ? 'warn' : undefined}
              delay={120}
            />
          </div>

          <div className="kpi-row">
            <Stat
              label="VaR (95%)"
              numericValue={summary.headline_var_95 ?? 0}
              formatter={formatCurrency}
              delay={180}
            />
            <Stat
              label="Expected Shortfall"
              numericValue={summary.headline_expected_shortfall_95 ?? 0}
              formatter={formatCurrency}
              delay={220}
            />
            <Stat
              label="Volatility"
              numericValue={summary.headline_annualized_volatility ?? 0}
              formatter={formatPercent}
              delay={260}
            />
            <Stat
              label="Max Drawdown"
              numericValue={summary.headline_max_drawdown ?? 0}
              formatter={formatPercent}
              tone="warn"
              delay={300}
            />
          </div>

          {driverItems.length > 0 && (
            <div className="card fade-in" style={{ animationDelay: '340ms' }}>
              <h3>Top Risk Drivers</h3>
              <BarRow items={driverItems} formatValue={(v) => v.toString()} />
            </div>
          )}

          <div className="card fade-in" style={{ animationDelay: '380ms' }}>
            <h3>Recent Analyses</h3>
            <RecentAnalyses analyses={summary.recent_analyses} />
          </div>
        </>
      )}

      <div className="explore-row">
        <div className="explore-row-label">Explore</div>
        <div className="panel-grid panel-grid-compact">
          {EXPLORE_PANELS.map(({ to, title, body, Icon }) => (
            <Link key={to} to={to} className="panel-card panel-card-compact">
              <div className="panel-card-icon">
                <Icon />
              </div>
              <h2>{title}</h2>
              <p>{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
