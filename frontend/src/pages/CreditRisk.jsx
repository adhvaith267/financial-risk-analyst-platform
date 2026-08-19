import { useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import Meter from '../components/Meter.jsx'
import { formatCurrency, formatPercent } from '../format.js'

export default function CreditRisk() {
  const [borrowerId, setBorrowerId] = useState('B1001')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function assess(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await api.get(`/credit/borrowers/${borrowerId}/assess`, {
        params: { explain: true },
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
        title="Credit Risk"
        subtitle="Probability of Default from the GMSC SageMaker model, combined with deterministic LGD/EAD logic: Expected Loss = PD x LGD x EAD."
      />

      <form className="inline-form" onSubmit={assess}>
        <input
          value={borrowerId}
          onChange={(e) => setBorrowerId(e.target.value)}
          placeholder="Borrower ID, e.g. B1001"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Assessing...' : 'Assess Borrower'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div
            className={
              'status-badge ' + (result.status === 'DECLINED' ? 'status-bad' : 'status-good')
            }
          >
            {result.status}
          </div>

          <div className="card">
            <h3>Probability of Default</h3>
            <Meter
              value={result.pd}
              max={Math.max(result.decline_threshold * 2.5, result.pd * 1.1)}
              threshold={result.decline_threshold}
              valueLabel={formatPercent(result.pd)}
              thresholdLabel={`decline threshold: ${formatPercent(result.decline_threshold)}`}
            />
          </div>

          <div className="stat-grid">
            <Stat label="LGD" value={formatPercent(result.lgd)} />
            <Stat label="EAD" value={formatCurrency(result.ead)} />
            <Stat label="Expected Loss" value={formatCurrency(result.expected_loss)} tone="warn" />
          </div>

          {result.risk_drivers?.length > 0 && (
            <div className="card">
              <h3>Risk Drivers</h3>
              <ul>
                {result.risk_drivers.map((driver, i) => (
                  <li key={i}>{driver}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="meta-row">Model version: {result.model_version}</div>
        </div>
      )}
    </div>
  )
}
