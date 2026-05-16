import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Wifi, Clock } from 'lucide-react'
import ScanModal from './ScanModal'

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/scans':           'Scans',
  '/topology':        'Network Topology',
  '/devices':         'Discovered Devices',
  '/vulnerabilities': 'Vulnerabilities',
  '/reports':         'Reports',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const [showModal, setShowModal] = useState(false)
  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] || 'PenTest Platform'

  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold font-display tracking-wider text-text">
            {title}
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-text-dim/50">
            <Wifi size={10} />
            <span>Lab Network</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-text-dim">
            <Clock size={12} />
            <span>{now}</span>
          </div>

          <button className="relative p-2 rounded-md hover:bg-surface-2 text-text-dim hover:text-text transition-colors">
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-danger rounded-full" />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <span className="text-bg text-lg leading-none">+</span>
            New Scan
          </button>
        </div>
      </header>

      {showModal && <ScanModal onClose={() => setShowModal(false)} />}
    </>
  )
}
