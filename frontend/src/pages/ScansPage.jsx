import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scansApi } from '../services/api'
import { Radar, Globe, Trash2, XCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import ScanModal from '../components/ScanModal'

const STATUS_STYLES = {
  pending:    'text-text-dim',
  discovery:  'text-accent',
  scanning:   'text-primary',
  analyzing:  'text-warn',
  completed:  'text-primary',
  failed:     'text-danger',
  cancelled:  'text-muted',
}

const STATUS_ICONS = {
  pending:    Clock,
  discovery:  Radar,
  scanning:   Radar,
  analyzing:  Radar,
  completed:  CheckCircle,
  failed:     AlertCircle,
  cancelled:  XCircle,
}

export default function ScansPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: scansApi.list,
    refetchInterval: 3000,
  })

  const handleDelete = async (e, id, name) => {
    e.stopPropagation()
    if (!confirm(`Delete scan "${name}"?`)) return
    try {
      await scansApi.delete(id)
      toast.success('Scan deleted')
      qc.invalidateQueries({ queryKey: ['scans'] })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCancel = async (e, id) => {
    e.stopPropagation()
    try {
      await scansApi.cancel(id)
      toast.success('Scan cancelled')
      qc.invalidateQueries({ queryKey: ['scans'] })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display tracking-wide">Scan History</h1>
          <p className="text-sm text-text-dim font-mono mt-0.5">{scans.length} total scans</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Radar size={14} />
          New Scan
        </button>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-text-dim font-mono">Loading scans...</div>
      ) : scans.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-4 text-text-dim">
          <Radar size={40} className="opacity-20" />
          <p className="font-mono">No scans yet. Launch your first scan.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">Launch Scan</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Scan', 'Target', 'Type', 'Status', 'Hosts', 'Vulns', 'Risk', 'Time', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-text-dim uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => {
                const StatusIcon = STATUS_ICONS[scan.status] || Clock
                const active = ['discovery','scanning','analyzing','pending'].includes(scan.status)
                return (
                  <tr
                    key={scan.id}
                    className="table-row cursor-pointer"
                    onClick={() => navigate(`/topology/${scan.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{scan.name}</div>
                      {scan.description && (
                        <div className="text-xs text-text-dim font-mono truncate max-w-[150px]">{scan.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-primary">{scan.target_network}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono capitalize bg-surface-2 px-2 py-0.5 rounded border border-border">
                        {scan.scan_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 ${STATUS_STYLES[scan.status]}`}>
                        <StatusIcon size={13} className={active ? 'animate-spin' : ''} />
                        <span className="text-xs font-mono capitalize">{scan.status}</span>
                      </div>
                      {active && (
                        <div className="mt-1.5 w-24 bg-border rounded-full h-1">
                          <div className="h-1 rounded-full bg-primary" style={{ width: `${scan.progress}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-center">{scan.hosts_discovered}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {scan.critical_count > 0 && <span className="text-xs font-mono text-danger">{scan.critical_count}C</span>}
                        {scan.high_count > 0    && <span className="text-xs font-mono text-orange-400">{scan.high_count}H</span>}
                        {scan.medium_count > 0  && <span className="text-xs font-mono text-warn">{scan.medium_count}M</span>}
                        {scan.vulnerabilities_found === 0 && <span className="text-xs font-mono text-text-dim">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-warn text-center">
                      {scan.overall_risk_score > 0 ? scan.overall_risk_score.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-text-dim">
                      {scan.created_at && formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/topology/${scan.id}`) }}
                          className="p-1.5 rounded hover:bg-surface-2 text-text-dim hover:text-primary transition-colors"
                          title="View Topology"
                        >
                          <Globe size={14} />
                        </button>
                        {active && (
                          <button
                            onClick={(e) => handleCancel(e, scan.id)}
                            className="p-1.5 rounded hover:bg-surface-2 text-text-dim hover:text-warn transition-colors"
                            title="Cancel Scan"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        {!active && (
                          <button
                            onClick={(e) => handleDelete(e, scan.id, scan.name)}
                            className="p-1.5 rounded hover:bg-surface-2 text-text-dim hover:text-danger transition-colors"
                            title="Delete Scan"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <ScanModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
