import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Radar, Globe, Server,
  ShieldAlert, FileText, Settings, Zap
} from 'lucide-react'

const links = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scans',           icon: Radar,           label: 'Scans' },
  { to: '/topology',        icon: Globe,           label: 'Topology' },
  { to: '/devices',         icon: Server,          label: 'Devices' },
  { to: '/vulnerabilities', icon: ShieldAlert,     label: 'Vulnerabilities' },
  { to: '/reports',         icon: FileText,        label: 'Reports' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 bg-surface border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Zap size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-primary font-display tracking-wider">PENTEST</div>
            <div className="text-xs text-text-dim font-mono">PLATFORM v1.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <div className="text-[10px] text-text-dim font-mono uppercase tracking-widest px-3 pt-3 pb-2">
          Navigation
        </div>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-text-dim font-mono">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-slow" />
          <span>System Online</span>
        </div>
        <div className="mt-1 text-[10px] text-text-dim/50 font-mono">
          For authorized lab use only
        </div>
      </div>
    </aside>
  )
}
