import { useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import Dumbbell from '../components/Dumbbell.jsx'
import BarRow from '../components/BarRow.jsx'
import { formatCurrency, formatPercent } from '../format.js'

export default function StressTesting() {
  const [portfolioId, setPortfolioId] = useState('P001')
  const [scenarioName, setScenarioName] = useState('recession')
  const [equityShock, setEquityShock] = useState(-20)
  const [rateShockBps, setRateShockBps] = useState(150)
  const [defaultShock, setDefaultShock] = useState(30)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function run(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await api.post(`/stress/portfolios/${portfolioId}/run`, {
        scenario_name: scenarioName,
        equity_shock: equityShock / 100,
        rate_shock_bps: Number(rateShockBps),
        default_shock: defaultShock / 100,
      })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Stress Testing"
        subtitle="Apply an equity/rate/default shock to a portfolio and the active loan book: market loss + credit loss = combined loss."
      />

      <form className="stress-form" onSubmit={run}>
        <label>
          Portfolio ID
          <input value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} />
        </label>
        <label>
          Scenario name
          <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
        </label>
        <label>
          Equity shock (%)
          <input
            type="number"
            value={equityShock}
            onChange={(e) => setEquityShock(e.target.value)}
          />
        </label>
        <label>
          Rate shock (bps)
          <input
            type="number"
            value={rateShockBps}
            onChange={(e) => setRateShockBps(e.target.value)}
          />
        </label>
        <label>
          Default shock (%)
          <input
            type="number"
            value={defaultShock}
            onChange={(e) => setDefaultShock(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Running...' : 'Run Stress Test'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div className="stat-grid">
            <Stat label="Market Loss" value={formatCurrency(result.market_loss)} />
            <Stat label="Credit Loss" value={formatCurrency(result.credit_loss)} />
            <Stat label="Combined Loss" value={formatCurrency(result.combined_loss)} tone="warn" />
          </div>

          <div className="card">
            <h3>Portfolio Value: Baseline vs Stressed</h3>
            <Dumbbell
              rows={[
                {
                  label: result.portfolio_id,
                  baseline: result.baseline_portfolio_value,
                  stressed: result.stressed_portfolio_value,
                },
              ]}
              formatValue={formatCurrency}
            />
          </div>

          <div className="card">
            <h3>Loss Breakdown</h3>
            <BarRow
              items={[
                { label: 'Market', value: result.market_loss, color: 'var(--series-1)' },
                { label: 'Credit', value: result.credit_loss, color: 'var(--series-2)' },
              ]}
              formatValue={formatCurrency}
            />
          </div>

          <div className="meta-row">
            Scenario: {result.scenario_name} (equity {formatPercent(result.equity_shock)}, rate +
            {result.rate_shock_bps}bps, default {formatPercent(result.default_shock)})
          </div>
        </div>
      )}
    </div>
  )
}
