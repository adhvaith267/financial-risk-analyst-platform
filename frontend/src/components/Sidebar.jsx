import { NavLink } from 'react-router-dom'
import { DashboardIcon, CreditIcon, MarketIcon, StressIcon, AgentIcon } from '../icons.jsx'

const links = [
  { to: '/', label: 'Dashboard', end: true, Icon: DashboardIcon },
  { to: '/credit', label: 'Credit Risk', Icon: CreditIcon },
  { to: '/market', label: 'Market Risk', Icon: MarketIcon },
  { to: '/stress', label: 'Stress Testing', Icon: StressIcon },
  { to: '/agent', label: 'AI Analyst', Icon: AgentIcon },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">FR</div>
        <div className="sidebar-brand-text">
          Financial Risk Analyst
          <span>AI-powered risk platform</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot" />
        Connected to live engines
      </div>
    </aside>
  )
}
