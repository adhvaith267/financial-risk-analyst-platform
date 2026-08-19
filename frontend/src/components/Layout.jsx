import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div key={location.pathname} className="page-fade">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
