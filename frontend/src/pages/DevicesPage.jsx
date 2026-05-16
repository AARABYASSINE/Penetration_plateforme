import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { devicesApi, scansApi } from '../services/api'
import { Server, ChevronDown, ChevronRight, Globe, Shield, Monitor, Router, Cpu, HelpCircle } from 'lucide-react'

const DEVICE_ICONS = {
  router: Router, switch: Globe, server: Server,
  workstation: Monitor, firewall: Shield, iot: Cpu, unknown: HelpCircle
}

const DEVICE_COLORS = {
  router: '#00ff9d', switch: '#00aaff', server: '#aa00ff',
  workstation: '#0066ff', firewall: '#ff6600', iot: '#ffaa00', unknown: '#4a5568'
}

function DeviceRow({ device }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = DEVICE_ICONS[device.device_type] || DEVICE_ICONS.unknown
  const color = DEVICE_COLORS[device.device_type] || DEVICE_COLORS.unknown
  const openPorts = device.open_ports || []

  return (
    <>
      <tr className="table-row cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3 w-6">
          {expanded ? <ChevronDown size={14} className="text-text-dim" /> : <ChevronRight size={14} className="text-text-dim" />}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon size={14} style={{ color }} />
            <code className="font-mono text-sm" style={{ color }}>{device.ip_address}</code>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-text-dim font-mono">{device.hostname || '—'}</td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono capitalize bg-surface-2 px-2 py-0.5 rounded border border-border"
                style={{ color, borderColor: color + '40' }}>
            {device.device_type}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-text-dim font-mono">{device.os_name || '—'}</td>
        <td className="px-4 py-3 text-sm font-mono text-text-dim">{device.mac_address || '—'}</td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-mono font-bold text-accent">{openPorts.length}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {openPorts.slice(0, 6).map(p => (
              <span key={p.port} className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-2 border border-border rounded text-text-dim">
                {p.port}/{p.protocol}
              </span>
            ))}
            {openPorts.length > 6 && (
              <span className="text-[10px] font-mono text-text-dim">+{openPorts.length - 6}</span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-2/30">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">Open Ports</h4>
                <div className="space-y-1">
                  {openPorts.map(p => (
                    <div key={p.port} className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-primary w-14">{p.port}/{p.protocol}</span>
                      <span className="text-accent w-20">{p.service}</span>
                      <span className="text-text-dim">{[p.product, p.version].filter(Boolean).join(' ')}</span>
                    </div>
                  ))}
                  {openPorts.length === 0 && <span className="text-text-dim text-xs font-mono">No open ports found</span>}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">Details</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex gap-3"><span className="text-text-dim w-24">Vendor</span><span className="text-text">{device.vendor || '—'}</span></div>
                  <div className="flex gap-3"><span className="text-text-dim w-24">OS Accuracy</span><span className="text-text">{device.os_accuracy ? `${device.os_accuracy}%` : '—'}</span></div>
                  <div className="flex gap-3"><span className="text-text-dim w-24">Centrality</span><span className="text-text">{device.network_centrality?.toFixed(4) || '—'}</span></div>
                  <div className="flex gap-3"><span className="text-text-dim w-24">Gateway</span><span className="text-text">{device.is_gateway ? '✓ Yes' : 'No'}</span></div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function DevicesPage() {
  const [scanFilter, setScanFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const { data: scans = [] } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list })
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', scanFilter, typeFilter],
    queryFn: () => devicesApi.list({ scan_id: scanFilter || undefined, device_type: typeFilter || undefined }),
  })

  const deviceTypes = [...new Set(devices.map(d => d.device_type))].sort()

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display tracking-wide">Discovered Devices</h1>
          <p className="text-sm text-text-dim font-mono mt-0.5">{devices.length} devices found</p>
        </div>
        <div className="flex gap-3">
          <select className="select-field w-52 text-xs" value={scanFilter} onChange={e => setScanFilter(e.target.value)}>
            <option value="">All Scans</option>
            {scans.filter(s => s.status === 'completed').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select className="select-field w-36 text-xs" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {deviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6" />
              {['IP Address', 'Hostname', 'Type', 'OS', 'MAC Address', 'Ports', 'Services'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-text-dim uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-text-dim font-mono">Loading devices...</td></tr>
            ) : devices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-text-dim font-mono">
                No devices found. Run a scan to discover network devices.
              </td></tr>
            ) : (
              devices.map(d => <DeviceRow key={d.id} device={d} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
