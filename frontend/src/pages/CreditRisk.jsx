import { useEffect, useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import Stat from '../components/Stat.jsx'
import Meter from '../components/Meter.jsx'
import EntitySelect from '../components/EntitySelect.jsx'
import { formatCurrency, formatPercent } from '../format.js'

function riskCategory(pd, threshold) {
  if (pd >= threshold) return { label: 'HIGH', tone: 'bad' }
  if (pd >= threshold * 0.5) return { label: 'MEDIUM', tone: 'neutral' }
  return { label: 'LOW', tone: 'good' }
}

export default function CreditRisk() {
  const [borrowers, setBorrowers] = useState([])
  const [borrowersLoading, setBorrowersLoading] = useState(true)
  const [borrowerId, setBorrowerId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showShap, setShowShap] = useState(false)

  useEffect(() => {
    api
      .get('/credit/borrowers')
      .then(({ data }) => {
        setBorrowers(data)
        if (data.length > 0) setBorrowerId(data[0].borrower_id)
      })
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setBorrowersLoading(false))
  }, [])

  async function assess(e) {
    e.preventDefault()
    if (!borrowerId) return
    setLoading(true)
    setError(null)
    setResult(null)
    setShowShap(false)
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

  const category = result ? riskCategory(result.pd, result.decline_threshold) : null

  return (
    <div>
      <PageHeader
        title="Credit Risk"
        subtitle="Probability of Default from the GMSC SageMaker model, combined with deterministic LGD/EAD logic: Expected Loss = PD x LGD x EAD."
      />

      <form className="inline-form" onSubmit={assess}>
        <EntitySelect
          label=""
          value={borrowerId}
          onChange={setBorrowerId}
          loading={borrowersLoading}
          placeholder="Select a borrower"
          options={borrowers.map((b) => ({
            id: b.borrower_id,
            label: `${b.borrower_id} — ${b.name}${b.has_active_loan ? '' : ' (no active loan)'}`,
          }))}
        />
        <button type="submit" disabled={loading || !borrowerId}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-block">
          <div className="card fade-in">
            <h3>Borrower Profile</h3>
            <div className="profile-grid">
              <div className="profile-item">
                <span className="profile-label">Monthly Income</span>
                <span className="profile-value">{formatCurrency(result.borrower.monthly_income)}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Outstanding Debt</span>
                <span className="profile-value">{formatCurrency(result.borrower.outstanding_balance)}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Revolving Utilization</span>
                <span className="profile-value">{formatPercent(result.borrower.revolving_utilization)}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Delinquencies</span>
                <span className="profile-value">{result.borrower.total_delinquencies}</span>
              </div>
            </div>
          </div>

          <div className="assessment-summary fade-in" style={{ animationDelay: '60ms' }}>
            <div>
              <div className="stat-label">Probability of Default</div>
              <div className="hero-value">{formatPercent(result.pd)}</div>
            </div>
            <div className={'status-badge status-' + category.tone}>{category.label} RISK</div>
            <div className="meta-row">Model: {result.model_version}</div>
          </div>

          <div className="card fade-in" style={{ animationDelay: '100ms' }}>
            <Meter
              value={result.pd}
              max={Math.max(result.decline_threshold * 2.5, result.pd * 1.1)}
              threshold={result.decline_threshold}
              valueLabel={formatPercent(result.pd)}
              thresholdLabel={`decline threshold: ${formatPercent(result.decline_threshold)}`}
            />
          </div>

          <div className="stat-grid">
            <Stat label="LGD" value={formatPercent(result.lgd)} delay={140} />
            <Stat label="EAD" value={formatCurrency(result.ead)} delay={170} />
            <Stat label="Expected Loss" value={formatCurrency(result.expected_loss)} tone="warn" delay={200} />
          </div>

          {result.risk_drivers?.length > 0 && (
            <div className="card fade-in" style={{ animationDelay: '240ms' }}>
              <h3>Risk Drivers</h3>
              <ul className="driver-list">
                {result.risk_drivers.map((driver, i) => (
                  <li key={i}>↑ {driver}</li>
                ))}
              </ul>
              <button
                type="button"
                className="link-button"
                onClick={() => setShowShap((v) => !v)}
              >
                {showShap ? 'Hide SHAP Explanation' : 'View SHAP Explanation'}
              </button>
              {showShap && (
                <p className="shap-explanation">
                  These attributes were identified by the model's SHAP explainability layer as
                  the strongest positive contributors to this borrower's PD — each one pushes the
                  estimated default probability up relative to the population baseline.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
