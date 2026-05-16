import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import ScansPage from './pages/ScansPage'
import TopologyView from './pages/TopologyView'
import DevicesPage from './pages/DevicesPage'
import VulnerabilitiesPage from './pages/VulnerabilitiesPage'
import ReportsPage from './pages/ReportsPage'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/scans"           element={<ScansPage />} />
            <Route path="/topology/:scanId" element={<TopologyView />} />
            <Route path="/topology"        element={<TopologyView />} />
            <Route path="/devices"         element={<DevicesPage />} />
            <Route path="/vulnerabilities" element={<VulnerabilitiesPage />} />
            <Route path="/reports"         element={<ReportsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
