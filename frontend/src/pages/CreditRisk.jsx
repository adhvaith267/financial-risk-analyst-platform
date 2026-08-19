import { useState } from 'react'
import api from '../api.js'
import Stat from '../components/Stat.jsx'
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
      <h1>Credit Risk</h1>
      <p className="subtitle">
        Probability of Default from the GMSC SageMaker model, combined with deterministic LGD/EAD
        logic: Expected Loss = PD x LGD x EAD.
      </p>

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

          <div className="stat-grid">
            <Stat label="Probability of Default" value={formatPercent(result.pd)} />
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
