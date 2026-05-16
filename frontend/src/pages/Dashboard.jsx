import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scansApi, vulnsApi } from '../services/api'
import { ShieldAlert, Server, Radar, TrendingUp, ChevronRight, Clock, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { formatDistanceToNow } from 'date-fns'

const SEVERITY_COLORS = {
  critical: '#ff3366', high: '#ff6600', medium: '#ffaa00', low: '#00aaff', info: '#4a5568'
}

function SeverityBadge({ severity }) {
  return <span className={`severity-${severity}`}>{severity}</span>
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        <Icon size={16} className={`${color} opacity-60`} />
      </div>
      <div className={`stat-number ${color}`}>{value}</div>
      {sub && <div className="text-xs text-text-dim font-mono mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: scans = [] } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list, refetchInterval: 5000 })
  const { data: vulns = [] } = useQuery({ queryKey: ['vulns'], queryFn: () => vulnsApi.list({ limit: 500 }) })

  const completedScans = scans.filter(s => s.status === 'completed')
  const activeScans    = scans.filter(s => ['discovery','scanning','analyzing','pending'].includes(s.status))
  const totalDevices   = completedScans.reduce((a, s) => a + s.hosts_discovered, 0)
  const criticalVulns  = vulns.filter(v => v.severity === 'critical')

  const severityCounts = ['critical','high','medium','low','info'].map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    count: vulns.filter(v => v.severity === sev).length,
    color: SEVERITY_COLORS[sev]
  }))

  const recentVulns = [...vulns].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 8)

  const latestScan = completedScans[0]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Radar}      label="Total Scans"     value={scans.length}     sub={`${activeScans.length} active`} />
        <StatCard icon={Server}     label="Devices Found"   value={totalDevices}     color="text-accent" />
        <StatCard icon={ShieldAlert} label="Vulnerabilities" value={vulns.length}    sub={`${criticalVulns.length} critical`} color="text-warn" />
        <StatCard icon={TrendingUp} label="Overall Risk"    value={latestScan ? `${latestScan.overall_risk_score.toFixed(1)}/10` : '—'} color="text-danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-dim mb-4">
            Vulnerabilities by Severity
          </h2>
          {vulns.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={severityCounts} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: '#6b7a8d', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7a8d', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2d3d', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 12 }}
                  labelStyle={{ color: '#00ff9d' }}
                  itemStyle={{ color: '#c8d6e5' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityCounts.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-dim font-mono text-sm">
              No vulnerability data. Launch a scan to begin.
            </div>
          )}
        </div>

        {/* Active scans */}
        <div className="card p-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-dim mb-4">
            Active Scans
          </h2>
          {activeScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[160px] text-text-dim">
              <Radar size={24} className="mb-2 opacity-30" />
              <p className="text-sm font-mono">No active scans</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeScans.map(scan => (
                <div key={scan.id} className="p-3 bg-surface-2 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold truncate">{scan.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary scan-pulse" />
                      <span className="text-xs font-mono text-primary capitalize">{scan.status}</span>
                    </div>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                      style={{ width: `${scan.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] font-mono text-text-dim">
                    <span>{scan.current_phase || 'Initializing...'}</span>
                    <span>{scan.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Vulnerabilities */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-dim">
            Top Risk Vulnerabilities
          </h2>
          <button
            onClick={() => navigate('/vulnerabilities')}
            className="text-xs font-mono text-text-dim hover:text-primary flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-border">
          {recentVulns.length === 0 ? (
            <div className="p-8 text-center text-text-dim font-mono text-sm">
              No vulnerabilities found yet.
            </div>
          ) : (
            recentVulns.map(v => (
              <div key={v.id} className="table-row px-5 py-3 flex items-center gap-4">
                <SeverityBadge severity={v.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.title}</div>
                  {v.cve_id && (
                    <div className="text-xs font-mono text-primary/70 mt-0.5">{v.cve_id}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono font-bold text-warn">{v.risk_score?.toFixed(1)}</div>
                  <div className="text-[10px] text-text-dim">risk score</div>
                </div>
                {v.exploit_available ? (
                  <div className="flex items-center gap-1 text-danger text-xs font-mono">
                    <AlertTriangle size={11} />
                    <span>Exploit</span>
                  </div>
                ) : <div className="w-16" />}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent scans */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-dim">Recent Scans</h2>
          <button onClick={() => navigate('/scans')} className="text-xs font-mono text-text-dim hover:text-primary flex items-center gap-1 transition-colors">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-border">
          {scans.slice(0, 5).map(scan => (
            <div
              key={scan.id}
              className="table-row px-5 py-3 flex items-center gap-4 cursor-pointer"
              onClick={() => navigate(`/topology/${scan.id}`)}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                scan.status === 'completed' ? 'bg-primary' :
                scan.status === 'failed'    ? 'bg-danger' :
                'bg-warn animate-pulse-slow'
              }`} />
              <div className="flex-1">
                <div className="text-sm font-medium">{scan.name}</div>
                <div className="text-xs font-mono text-text-dim mt-0.5">{scan.target_network}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono capitalize text-text-dim">{scan.status}</div>
                {scan.created_at && (
                  <div className="text-[10px] text-text-dim/50 flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={9} />
                    {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-mono text-text">{scan.hosts_discovered}</div>
                <div className="text-[10px] text-text-dim">hosts</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-mono font-bold ${scan.critical_count > 0 ? 'text-danger' : 'text-text'}`}>
                  {scan.critical_count}
                </div>
                <div className="text-[10px] text-text-dim">critical</div>
              </div>
            </div>
          ))}
          {scans.length === 0 && (
            <div className="p-8 text-center text-text-dim font-mono text-sm">
              No scans yet. Click "New Scan" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
