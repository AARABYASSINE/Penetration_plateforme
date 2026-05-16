import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { vulnsApi, scansApi } from '../services/api'
import { ShieldAlert, ChevronDown, ChevronRight, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const SEVERITY_ORDER = ['critical','high','medium','low','info']
const SEVERITY_LABELS = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO' }

function SeverityBadge({ severity }) {
  return <span className={`severity-${severity}`}>{SEVERITY_LABELS[severity] || severity}</span>
}

function VulnRow({ vuln, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="table-row cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3 w-6">
          {expanded ? <ChevronDown size={13} className="text-text-dim" /> : <ChevronRight size={13} className="text-text-dim" />}
        </td>
        <td className="px-4 py-3">
          <SeverityBadge severity={vuln.severity} />
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium">{vuln.title}</div>
          {vuln.cve_id && <code className="text-xs font-mono text-primary/80 mt-0.5 block">{vuln.cve_id}</code>}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-warn font-bold">
          {vuln.cvss_score?.toFixed(1) || '—'}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-danger font-bold">
          {vuln.risk_score?.toFixed(1) || '—'}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-text-dim">
          {vuln.affected_service && <><span className="text-accent">{vuln.affected_service}</span>:{vuln.affected_port}</>}
        </td>
        <td className="px-4 py-3">
          {vuln.exploit_available ? (
            <div className="flex items-center gap-1 text-danger text-xs font-mono">
              <AlertTriangle size={11} /> YES
            </div>
          ) : (
            <span className="text-text-dim text-xs font-mono">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-mono capitalize ${
            vuln.status === 'remediated' ? 'text-primary' :
            vuln.status === 'false_positive' ? 'text-text-dim' :
            vuln.status === 'confirmed' ? 'text-danger' : 'text-warn'
          }`}>
            {vuln.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-text-dim capitalize">
          {vuln.detected_by || '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-2/30">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                {vuln.description && (
                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1.5">Description</h4>
                    <p className="text-sm text-text/80 font-mono leading-relaxed">{vuln.description}</p>
                  </div>
                )}
                {vuln.remediation && (
                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1.5">Remediation</h4>
                    <p className="text-sm text-text/80 font-mono leading-relaxed">{vuln.remediation}</p>
                  </div>
                )}
                {vuln.cvss_vector && (
                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1.5">CVSS Vector</h4>
                    <code className="text-xs text-accent">{vuln.cvss_vector}</code>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {vuln.exploitation_guidance && (
                  <div className="p-3 bg-danger/5 border border-danger/20 rounded-md">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-danger mb-1.5">
                      ⚠ Exploitation Guidance (Lab Only)
                    </h4>
                    <p className="text-sm text-text/80 font-mono leading-relaxed">{vuln.exploitation_guidance}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">Risk Breakdown</h4>
                  <div className="space-y-1 text-xs font-mono">
                    {[
                      ['CVSS Score', vuln.cvss_score?.toFixed(1)],
                      ['Risk Score', vuln.risk_score?.toFixed(2)],
                      ['Centrality Factor', vuln.centrality_factor?.toFixed(4)],
                      ['Attack Path Prob.', `${((vuln.attack_path_probability || 0) * 100).toFixed(0)}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-text-dim">{k}</span>
                        <span className="text-text font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {['open','confirmed','false_positive','remediated'].map(s => (
                    <button
                      key={s}
                      onClick={() => onStatusChange(vuln.id, s)}
                      className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors capitalize ${
                        vuln.status === s
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-border text-text-dim hover:border-border/80'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function VulnerabilitiesPage() {
  const qc = useQueryClient()
  const [scanFilter, setScanFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: scans = [] } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list })
  const { data: vulns = [], isLoading } = useQuery({
    queryKey: ['vulns', scanFilter, severityFilter, statusFilter],
    queryFn: () => vulnsApi.list({
      scan_id: scanFilter || undefined,
      severity: severityFilter || undefined,
      status: statusFilter || undefined,
      limit: 1000,
    }),
  })

  const filtered = vulns.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) || (v.cve_id || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusChange = async (id, status) => {
    try {
      await vulnsApi.updateStatus(id, status)
      qc.invalidateQueries({ queryKey: ['vulns'] })
      toast.success(`Status updated to ${status}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Group by severity
  const grouped = SEVERITY_ORDER.reduce((acc, sev) => {
    const items = filtered.filter(v => v.severity === sev)
    if (items.length) acc[sev] = items
    return acc
  }, {})

  const counts = SEVERITY_ORDER.reduce((a, s) => ({ ...a, [s]: vulns.filter(v => v.severity === s).length }), {})

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display tracking-wide">Vulnerabilities</h1>
          <p className="text-sm text-text-dim font-mono mt-0.5">{filtered.length} findings</p>
        </div>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-5 gap-3">
        {SEVERITY_ORDER.map(sev => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(f => f === sev ? '' : sev)}
            className={`stat-card items-center transition-all duration-150 ${severityFilter === sev ? 'ring-1 ring-current' : 'hover:ring-1 hover:ring-border'}`}
            style={severityFilter === sev ? { color: `var(--color-${sev === 'critical' ? 'danger' : sev})` } : {}}
          >
            <div className={`stat-number severity-${sev} text-center text-xl`}>{counts[sev]}</div>
            <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">{sev}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input-field max-w-xs text-sm"
          placeholder="Search CVE, title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select-field w-48 text-sm" value={scanFilter} onChange={e => setScanFilter(e.target.value)}>
          <option value="">All Scans</option>
          {scans.filter(s => s.status === 'completed').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select-field w-36 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['open','confirmed','false_positive','remediated'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6" />
              {['Severity','Title','CVSS','Risk Score','Service:Port','Exploit','Status','Source'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-text-dim uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-text-dim font-mono">Loading vulnerabilities...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-16 text-center text-text-dim font-mono">
                <ShieldAlert size={32} className="mx-auto mb-3 opacity-20" />
                No vulnerabilities found.
              </td></tr>
            ) : (
              filtered.map(v => <VulnRow key={v.id} vuln={v} onStatusChange={handleStatusChange} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
