import { Link } from 'react-router-dom'

const panels = [
  {
    to: '/credit',
    title: 'Credit Risk',
    body: 'Assess a borrower: Probability of Default from the GMSC model, plus LGD, EAD, Expected Loss, and SHAP risk drivers.',
  },
  {
    to: '/market',
    title: 'Market Risk',
    body: "A portfolio's current volatility, historical/parametric VaR, Expected Shortfall, max drawdown, and concentration.",
  },
  {
    to: '/stress',
    title: 'Stress Testing',
    body: 'Run an equity/rate/default shock scenario against a portfolio and the active loan book.',
  },
  {
    to: '/agent',
    title: 'AI Analyst',
    body: 'Ask a question in plain language - the agent decides which of the above to run and explains the result.',
  },
]

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p className="subtitle">
        AI-powered financial risk analysis: deterministic engines compute the numbers, the agent
        explains them.
      </p>
      <div className="panel-grid">
        {panels.map((panel) => (
          <Link key={panel.to} to={panel.to} className="panel-card">
            <h2>{panel.title}</h2>
            <p>{panel.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
