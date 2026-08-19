const TOOL_LABELS = {
  get_borrower: 'Borrower record (RDS)',
  get_portfolio: 'Portfolio record (RDS)',
  assess_credit_risk: 'Credit Risk Engine — SageMaker PD model + deterministic LGD/EAD/EL',
  assess_market_risk: 'Market Risk Engine — historical simulation',
  run_stress_scenario: 'Stress Testing Engine',
}

export default function EvidencePanel({ trace }) {
  if (!trace || trace.length === 0) return null
  const toolNames = [...new Set(trace.map((step) => step.tool))]

  return (
    <div className="evidence-panel">
      <div className="evidence-title">Evidence</div>
      <ul>
        {toolNames.map((tool) => (
          <li key={tool}>{TOOL_LABELS[tool] || tool}</li>
        ))}
      </ul>
      <p className="evidence-disclaimer">
        Every figure above came from one of these tools — never generated directly by the
        language model.
      </p>
    </div>
  )
}
