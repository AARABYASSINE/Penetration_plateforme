import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Radar, Info } from 'lucide-react'
import { scansApi } from '../services/api'
import toast from 'react-hot-toast'

const SCAN_TYPES = [
  { value: 'quick',    label: 'Quick Scan',    desc: 'Ping sweep + top 100 ports (~2 min)' },
  { value: 'standard',label: 'Standard Scan',  desc: 'Full port scan + service detection (~10 min)' },
  { value: 'deep',     label: 'Deep Scan',      desc: 'Full scan + vulnerability scripts (~30 min)' },
  { value: 'stealth',  label: 'Stealth Scan',   desc: 'SYN scan, low noise (~15 min)' },
]

export default function ScanModal({ onClose }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    target_network: '192.168.1.0/24',
    description: '',
    scan_type: 'standard',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Scan name is required')
    if (!form.target_network.trim()) return toast.error('Target network is required')

    setLoading(true)
    try {
      await scansApi.create(form)
      toast.success(`Scan "${form.name}" launched!`)
      qc.invalidateQueries({ queryKey: ['scans'] })
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg card glow-primary animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Radar size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold font-display text-text tracking-wide">Launch New Scan</h2>
              <p className="text-xs text-text-dim font-mono">Authorized lab environment only</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-2 text-text-dim hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">
              Scan Name *
            </label>
            <input
              className="input-field"
              placeholder="e.g. Lab Network Assessment"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">
              Target Network (CIDR) *
            </label>
            <input
              className="input-field"
              placeholder="192.168.1.0/24"
              value={form.target_network}
              onChange={e => set('target_network', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">
              Scan Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SCAN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => set('scan_type', t.value)}
                  className={`p-3 rounded-md border text-left transition-all duration-150 ${
                    form.scan_type === t.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-text-dim hover:border-border/80'
                  }`}
                >
                  <div className="font-semibold text-sm font-display">{t.label}</div>
                  <div className="text-xs font-mono opacity-70 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">
              Description (optional)
            </label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder="Notes about this scan..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-warn/5 border border-warn/20 rounded-md">
            <Info size={14} className="text-warn mt-0.5 flex-shrink-0" />
            <p className="text-xs font-mono text-warn/80">
              Ensure you have explicit authorization to scan the target network. Unauthorized scanning is illegal.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><span className="w-3 h-3 border border-bg/40 border-t-bg rounded-full animate-spin" />Launching...</>
            ) : (
              <><Radar size={14} />Launch Scan</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
