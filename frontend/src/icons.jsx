const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

export function CreditIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <line x1="2.5" y1="10" x2="21.5" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  )
}

export function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <polyline points="3,17 9,10 13,14 21,5" />
      <polyline points="15,5 21,5 21,11" />
    </svg>
  )
}

export function StressIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M4 12a8 8 0 1 1 3 6.2" />
      <polyline points="3,20 4,14 10,15" />
    </svg>
  )
}

export function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <line x1="12" y1="7" x2="12" y2="3" />
      <circle cx="12" cy="2.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
