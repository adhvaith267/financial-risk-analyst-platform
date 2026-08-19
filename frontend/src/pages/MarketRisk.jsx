import { useState } from 'react'
import api from '../api.js'
import Stat from '../components/Stat.jsx'
import { formatCurrency, formatPercent } from '../format.js'

export default function MarketRisk() {
  const [portfolioId, setPortfolioId] = useState('P001')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function assess(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await api.get(`/market/portfolios/${portfolioId}/risk`)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Market Risk</h1>
      <p className="subtitle">
        Historical-simulation risk: today's portfolio weights applied to historical daily returns.
      </p>

      <form className="inline-form" onSubmit={assess}>
        <input
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          placeholder="Portfolio ID, e.g. P001"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Calculating...' : 'Assess Portfolio'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div className="meta-row">
            Portfolio value: {formatCurrency(result.portfolio_value)} as of {result.as_of}
          </div>

          <div className="stat-grid">
            <Stat label="Annualized Volatility" value={formatPercent(result.annualized_volatility)} />
            <Stat label="Historical VaR (95%)" value={formatCurrency(result.historical_var_95)} />
            <Stat label="Historical VaR (99%)" value={formatCurrency(result.historical_var_99)} />
            <Stat label="Parametric VaR (95%)" value={formatCurrency(result.parametric_var_95)} />
            <Stat label="Expected Shortfall (95%)" value={formatCurrency(result.expected_shortfall_95)} />
            <Stat label="Max Drawdown" value={formatPercent(result.max_drawdown)} tone="warn" />
            <Stat label="Concentration (HHI)" value={result.hhi.toFixed(3)} />
            <Stat label="Largest Position" value={formatPercent(result.max_position_weight)} />
          </div>

          <div className="card">
            <h3>Portfolio Weights</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.weights).map(([asset, weight]) => (
                  <tr key={asset}>
                    <td>{asset}</td>
                    <td>{formatPercent(weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
