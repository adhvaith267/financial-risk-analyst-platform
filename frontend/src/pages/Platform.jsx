import { useState } from "react"
import { Link } from "react-router-dom"
import { DashboardIcon, CreditIcon, MarketIcon, StressIcon, AgentIcon } from "../icons.jsx"
import Dashboard from "./Dashboard.jsx"
import CreditRisk from "./CreditRisk.jsx"
import MarketRisk from "./MarketRisk.jsx"
import StressTesting from "./StressTesting.jsx"
import AIAnalyst from "./AIAnalyst.jsx"

const views = [
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon, Component: Dashboard },
  { id: "credit", label: "Credit risk", Icon: CreditIcon, Component: CreditRisk },
  { id: "market", label: "Market risk", Icon: MarketIcon, Component: MarketRisk },
  { id: "stress", label: "Stress testing", Icon: StressIcon, Component: StressTesting },
  { id: "agent", label: "Riskora AI", Icon: AgentIcon, Component: AIAnalyst },
]

export default function Platform() {
  const [view, setView] = useState("dashboard")
  const current = views.find((item) => item.id === view)
  const ActiveView = current.Component

  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <Link to="/" className="platform-brand">
          <span>R</span>
          <div><strong>RISKORA</strong><small>Workspace home</small></div>
        </Link>
        <div className="platform-sidebar-label">Workspace</div>
        <nav className="platform-nav">
          {views.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setView(id)} className={"platform-nav-item " + (view === id ? "active" : "")} aria-current={view === id ? "page" : undefined}>
              <Icon />{label}
            </button>
          ))}
        </nav>
        <div className="platform-sidebar-footer"><span>Riskora</span><small>Evidence-first analysis</small></div>
      </aside>
      <main className={"platform-workspace " + (view === "agent" ? "agent-view" : "")}>
        <div className="platform-page-content" key={view}><ActiveView onNavigate={setView} /></div>
      </main>
    </div>
  )
}
