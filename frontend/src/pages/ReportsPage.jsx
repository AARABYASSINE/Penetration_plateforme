import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportsApi, scansApi } from '../services/api'
import { FileText, Download, Eye, Plus, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ReportsPage() {
  const qc = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [selectedScan, setSelectedScan] = useState('')
  const [reportTitle, setReportTitle] = useState('')

  const { data: reports = [], isLoading } = useQuery({ queryKey: ['reports'], queryFn: reportsApi.list })
  const { data: scans = [] } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list })

  const completedScans = scans.filter(s => s.status === 'completed' && !reports.find(r => r.scan_id === s.id))

  const handleGenerate = async () => {
    if (!selectedScan) return toast.error('Select a scan first')
    setGenerating(true)
    try {
      await reportsApi.generate({ scan_id: selectedScan, title: reportTitle || undefined })
      toast.success('Report generated successfully!')
      qc.invalidateQueries({ queryKey: ['reports'] })
      setSelectedScan('')
      setReportTitle('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display tracking-wide">Security Reports</h1>
          <p className="text-sm text-text-dim font-mono mt-0.5">{reports.length} reports generated</p>
        </div>
      </div>

      {/* Generate new report */}
      {completedScans.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-dim mb-4">Generate New Report</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-text-dim uppercase tracking-wider mb-1.5">Scan</label>
              <select className="select-field text-sm" value={selectedScan} onChange={e => setSelectedScan(e.target.value)}>
                <option value="">— Select Scan —</option>
                {completedScans.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.target_network})</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-text-dim uppercase tracking-wider mb-1.5">Report Title (optional)</label>
              <input
                className="input-field text-sm"
                placeholder="Security Assessment Report..."
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedScan}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 h-[38px]"
            >
              {generating ? (
                <><span className="w-3 h-3 border border-bg/40 border-t-bg rounded-full animate-spin" />Generating...</>
              ) : (
                <><Plus size={14} />Generate Report</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <div className="card p-12 text-center text-text-dim font-mono">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-4 text-text-dim">
          <FileText size={40} className="opacity-20" />
          <p className="font-mono">No reports yet. Complete a scan and generate a report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const scan = scans.find(s => s.id === report.scan_id)
            return (
              <div key={report.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text truncate">{report.title}</h3>
                      {report.executive_summary && (
                        <p className="text-sm text-text-dim font-mono mt-1 line-clamp-2">{report.executive_summary}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        {scan && (
                          <span className="text-xs font-mono text-primary/70">
                            {scan.target_network}
                          </span>
                        )}
                        {report.generated_at && (
                          <div className="flex items-center gap-1 text-xs font-mono text-text-dim">
                            <Calendar size={11} />
                            {format(new Date(report.generated_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        )}
                        {report.findings_summary && (
                          <>
                            {report.findings_summary.by_severity?.critical > 0 && (
                              <span className="severity-critical">{report.findings_summary.by_severity.critical} Critical</span>
                            )}
                            {report.findings_summary.by_severity?.high > 0 && (
                              <span className="severity-high">{report.findings_summary.by_severity.high} High</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {report.html_path && (
                      <a
                        href={reportsApi.htmlUrl(report.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost flex items-center gap-1.5 text-xs"
                      >
                        <Eye size={13} /> View HTML
                      </a>
                    )}
                    {report.json_path && (
                      <a
                        href={`/api/v1/reports/${report.id}`}
                        download
                        className="btn-ghost flex items-center gap-1.5 text-xs"
                      >
                        <Download size={13} /> JSON
                      </a>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                {report.recommendations && report.recommendations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">
                      Top Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {report.recommendations.slice(0, 3).map((r, i) => (
                        <li key={i} className="text-xs font-mono text-text/80 flex items-start gap-2">
                          <span className="text-primary mt-0.5">▶</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
