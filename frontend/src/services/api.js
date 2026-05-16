import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'API Error'
    console.error('[API]', msg)
    return Promise.reject(new Error(msg))
  }
)

// ── Scans ─────────────────────────────────────────────────────────────
export const scansApi = {
  list: ()            => api.get('/scans').then(r => r.data),
  get:  (id)          => api.get(`/scans/${id}`).then(r => r.data),
  create: (payload)   => api.post('/scans', payload).then(r => r.data),
  cancel: (id)        => api.post(`/scans/${id}/cancel`).then(r => r.data),
  delete: (id)        => api.delete(`/scans/${id}`),
}

// ── Devices ───────────────────────────────────────────────────────────
export const devicesApi = {
  list: (params = {}) => api.get('/devices', { params }).then(r => r.data),
  get:  (id)          => api.get(`/devices/${id}`).then(r => r.data),
}

// ── Vulnerabilities ───────────────────────────────────────────────────
export const vulnsApi = {
  list:         (params = {}) => api.get('/vulnerabilities', { params }).then(r => r.data),
  get:          (id)          => api.get(`/vulnerabilities/${id}`).then(r => r.data),
  updateStatus: (id, status)  => api.patch(`/vulnerabilities/${id}/status`, null, { params: { status } }).then(r => r.data),
  import:       (vulns)       => api.post('/vulnerabilities/import', vulns).then(r => r.data),
}

// ── Reports ───────────────────────────────────────────────────────────
export const reportsApi = {
  generate: (payload) => api.post('/reports/generate', payload).then(r => r.data),
  list:     ()        => api.get('/reports').then(r => r.data),
  get:      (id)      => api.get(`/reports/${id}`).then(r => r.data),
  htmlUrl:  (id)      => `/api/v1/reports/${id}/html`,
}

// ── Topology ──────────────────────────────────────────────────────────
export const topologyApi = {
  get: (scanId) => api.get(`/topology/${scanId}`).then(r => r.data),
}

// ── Health ────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
}

export default api
