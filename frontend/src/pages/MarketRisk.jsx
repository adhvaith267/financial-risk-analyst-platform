import { useEffect, useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import BarRow from '../components/BarRow.jsx'
import EntitySelect from '../components/EntitySelect.jsx'
import LineChart from '../components/LineChart.jsx'
import CorrelationMatrix from '../components/CorrelationMatrix.jsx'
import { formatCurrency, formatPercent } from '../format.js'

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']

export default function MarketRisk() {
  const [portfolios, setPortfolios] = useState([])
  const [portfoliosLoading, setPortfoliosLoading] = useState(true)
  const [portfolioId, setPortfolioId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [view, setView] = useState('history') // 'history' | 'correlation'

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

  async function assess(e) {
    e.preventDefault()
    if (!portfolioId) return
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

  const weightItems = result
    ? Object.entries(result.weights)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([asset, weight], i) => ({
          label: asset,
          value: weight,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
        }))
    : []

  return (
    <div>
      <PageHeader
        title="Market Risk"
        subtitle="Historical-simulation risk: today's portfolio weights applied to historical daily returns."
      />

      <form className="inline-form" onSubmit={assess}>
        <EntitySelect
          label=""
          value={portfolioId}
          onChange={setPortfolioId}
          loading={portfoliosLoading}
          placeholder="Select a portfolio"
          options={portfolios.map((p) => ({ id: p.portfolio_id, label: `${p.portfolio_id} — ${p.name}` }))}
        />
        <button type="submit" disabled={loading || !portfolioId}>
          {loading ? 'Calculating…' : 'Analyze'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div className="meta-row">
            Portfolio value: {formatCurrency(result.portfolio_value)} as of {result.as_of}
          </div>

          <div className="stat-grid">
            <Stat label="Annualized Volatility" value={formatPercent(result.annualized_volatility)} delay={0} />
            <Stat label="Historical VaR (95%)" value={formatCurrency(result.historical_var_95)} delay={30} />
            <Stat label="Historical VaR (99%)" value={formatCurrency(result.historical_var_99)} delay={60} />
            <Stat label="Parametric VaR (95%)" value={formatCurrency(result.parametric_var_95)} delay={90} />
            <Stat label="Expected Shortfall (95%)" value={formatCurrency(result.expected_shortfall_95)} delay={120} />
            <Stat label="Max Drawdown" value={formatPercent(result.max_drawdown)} tone="warn" delay={150} />
            <Stat label="Concentration (HHI)" value={result.hhi.toFixed(3)} delay={180} />
            <Stat label="Largest Position" value={formatPercent(result.max_position_weight)} delay={210} />
          </div>

          <div className="card fade-in" style={{ animationDelay: '250ms' }}>
            <h3>Portfolio Composition</h3>
            <BarRow items={weightItems} formatValue={formatPercent} />
          </div>

          <div className="card fade-in" style={{ animationDelay: '290ms' }}>
            <div className="card-header-row">
              <h3 style={{ margin: 0 }}>{view === 'history' ? 'Historical Value' : 'Correlation Matrix'}</h3>
              <div className="view-toggle">
                <button
                  type="button"
                  className={view === 'history' ? 'active' : ''}
                  onClick={() => setView('history')}
                >
                  Historical Value
                </button>
                <button
                  type="button"
                  className={view === 'correlation' ? 'active' : ''}
                  onClick={() => setView('correlation')}
                >
                  Correlation Matrix
                </button>
              </div>
            </div>
            {view === 'history' ? (
              <LineChart data={result.value_history} />
            ) : (
              <CorrelationMatrix matrix={result.correlation_matrix} />
            )}
          </div>

          {result.risk_drivers?.length > 0 && (
            <div className="card fade-in" style={{ animationDelay: '330ms' }}>
              <h3>Risk Drivers</h3>
              <ul className="driver-list">
                {result.risk_drivers.map((driver, i) => (
                  <li key={i}>{driver}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
