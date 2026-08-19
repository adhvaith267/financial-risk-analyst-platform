import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/credit', label: 'Credit Risk' },
  { to: '/market', label: 'Market Risk' },
  { to: '/stress', label: 'Stress Testing' },
  { to: '/agent', label: 'AI Analyst' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Financial Risk Analyst</div>
        <nav className="nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
