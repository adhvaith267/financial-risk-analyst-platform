import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import { CreditIcon, MarketIcon, StressIcon, AgentIcon } from '../icons.jsx'
import { formatPercent, formatCurrency } from '../format.js'

const panels = [
  {
    to: '/credit',
    title: 'Credit Risk',
    Icon: CreditIcon,
    body: 'Assess a borrower: Probability of Default from the GMSC model, plus LGD, EAD, Expected Loss, and SHAP risk drivers.',
  },
  {
    to: '/market',
    title: 'Market Risk',
    Icon: MarketIcon,
    body: "A portfolio's current volatility, historical/parametric VaR, Expected Shortfall, max drawdown, and concentration.",
  },
  {
    to: '/stress',
    title: 'Stress Testing',
    Icon: StressIcon,
    body: 'Run an equity/rate/default shock scenario against a portfolio and the active loan book.',
  },
  {
    to: '/agent',
    title: 'AI Analyst',
    Icon: AgentIcon,
    body: 'Ask a question in plain language - the agent decides which of the above to run and explains the result.',
  },
]

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="AI-powered financial risk analysis: deterministic engines compute the numbers, the agent explains them."
      />

      {error && <div className="error-banner">Could not load summary: {error}</div>}

      {summary && (
        <div className="kpi-row">
          <Stat label="Borrowers" value={summary.borrower_count} />
          <Stat label="Active Loans" value={summary.loan_count} />
          <Stat label="Portfolios" value={summary.portfolio_count} />
          <Stat label="Stress Tests Run" value={summary.stress_test_count} />
          {summary.headline_portfolio_id && (
            <>
              <Stat
                label={`${summary.headline_portfolio_id} Volatility`}
                value={formatPercent(summary.headline_annualized_volatility)}
              />
              <Stat
                label={`${summary.headline_portfolio_id} VaR (95%)`}
                value={formatCurrency(summary.headline_var_95)}
                tone="warn"
              />
            </>
          )}
        </div>
      )}

      <div className="panel-grid">
        {panels.map(({ to, title, body, Icon }) => (
          <Link key={to} to={to} className="panel-card">
            <div className="panel-card-icon">
              <Icon />
            </div>
            <h2>{title}</h2>
            <p>{body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
