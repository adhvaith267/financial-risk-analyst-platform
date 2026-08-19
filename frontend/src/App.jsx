import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CreditRisk from './pages/CreditRisk.jsx'
import MarketRisk from './pages/MarketRisk.jsx'
import StressTesting from './pages/StressTesting.jsx'
import AIAnalyst from './pages/AIAnalyst.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="credit" element={<CreditRisk />} />
          <Route path="market" element={<MarketRisk />} />
          <Route path="stress" element={<StressTesting />} />
          <Route path="agent" element={<AIAnalyst />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
