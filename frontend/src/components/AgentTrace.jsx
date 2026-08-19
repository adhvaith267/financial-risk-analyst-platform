export default function AgentTrace({ steps }) {
  if (!steps || steps.length === 0) return null

  return (
    <div className="agent-trace">
      <div className="agent-trace-title">Analysis Steps</div>
      <ul className="agent-trace-list">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`agent-trace-step trace-${step.status}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="trace-icon">{step.status === 'error' ? '✕' : '✓'}</span>
            {step.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
