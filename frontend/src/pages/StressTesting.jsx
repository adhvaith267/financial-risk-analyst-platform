import { useEffect, useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import Dumbbell from '../components/Dumbbell.jsx'
import BarRow from '../components/BarRow.jsx'
import EntitySelect from '../components/EntitySelect.jsx'
import { formatCurrency, formatPercent } from '../format.js'

export default function StressTesting() {
  const [portfolios, setPortfolios] = useState([])
  const [portfoliosLoading, setPortfoliosLoading] = useState(true)
  const [portfolioId, setPortfolioId] = useState('')
  const [scenarioName, setScenarioName] = useState('recession')
  const [equityShock, setEquityShock] = useState(-20)
  const [rateShockBps, setRateShockBps] = useState(150)
  const [defaultShock, setDefaultShock] = useState(30)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/market/portfolios')
      .then(({ data }) => {
        setPortfolios(data)
        if (data.length > 0) setPortfolioId(data[0].portfolio_id)
      })
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setPortfoliosLoading(false))
  }, [])

  async function run(e) {
    e.preventDefault()
    if (!portfolioId) return
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
        <EntitySelect
          label="Portfolio"
          value={portfolioId}
          onChange={setPortfolioId}
          loading={portfoliosLoading}
          placeholder="Select a portfolio"
          options={portfolios.map((p) => ({ id: p.portfolio_id, label: `${p.portfolio_id} — ${p.name}` }))}
        />
        <label>
          Scenario name
          <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
        </label>

        <label className="slider-field">
          Equity Shock
          <span className="slider-value">{equityShock}%</span>
          <input
            type="range"
            min="-60"
            max="0"
            value={equityShock}
            onChange={(e) => setEquityShock(Number(e.target.value))}
          />
        </label>
        <label className="slider-field">
          Interest Rate Shock
          <span className="slider-value">+{rateShockBps}bps</span>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={rateShockBps}
            onChange={(e) => setRateShockBps(Number(e.target.value))}
          />
        </label>
        <label className="slider-field">
          Default Shock
          <span className="slider-value">+{defaultShock}%</span>
          <input
            type="range"
            min="0"
            max="150"
            value={defaultShock}
            onChange={(e) => setDefaultShock(Number(e.target.value))}
          />
        </label>

        <button type="submit" disabled={loading || !portfolioId}>
          {loading ? 'Running…' : 'Run Stress Test'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div className="stat-grid">
            <Stat label="Market Loss" value={formatCurrency(result.market_loss)} delay={0} />
            <Stat label="Credit Loss" value={formatCurrency(result.credit_loss)} delay={40} />
            <Stat label="Combined Loss" value={formatCurrency(result.combined_loss)} tone="warn" delay={80} />
          </div>

          <div className="card fade-in" style={{ animationDelay: '130ms' }}>
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
            <table className="data-table baseline-stressed-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Baseline</th>
                  <th>Stressed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Portfolio Value</td>
                  <td>{formatCurrency(result.baseline_portfolio_value)}</td>
                  <td>{formatCurrency(result.stressed_portfolio_value)}</td>
                </tr>
                <tr>
                  <td>Total Expected Loss</td>
                  <td>{formatCurrency(result.baseline_total_expected_loss)}</td>
                  <td>{formatCurrency(result.stressed_total_expected_loss)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card fade-in" style={{ animationDelay: '170ms' }}>
            <h3>Impact by Risk Type</h3>
            <BarRow
              items={[
                { label: 'Market', value: result.market_loss, color: 'var(--series-1)' },
                { label: 'Credit', value: result.credit_loss, color: 'var(--series-2)' },
              ]}
              formatValue={formatCurrency}
            />
          </div>

          {result.vulnerabilities?.length > 0 && (
            <div className="card fade-in" style={{ animationDelay: '210ms' }}>
              <h3>Key Vulnerabilities</h3>
              <ul className="driver-list">
                {result.vulnerabilities.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="meta-row">
            Scenario: {result.scenario_name} (equity {formatPercent(result.equity_shock)}, rate +
            {result.rate_shock_bps}bps, default {formatPercent(result.default_shock)})
          </div>
        </div>
      )}
    </div>
  )
}
