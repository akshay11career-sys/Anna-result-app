import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
})

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.detail || err.message || 'Network error'
    return Promise.reject(new Error(msg))
  }
)

// ── Upload ───────────────────────────────────────────────────
export const uploadPDF      = (file, semester = 1) => {
  const form = new FormData()
  form.append('file', file)
  form.append('semester', semester)
  return api.post('/upload/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const getBatchStatus = (batchId) => api.get(`/upload/status/${batchId}`)
export const listBatches    = ()        => api.get('/upload/batches')
export const deleteBatch    = (batchId) => api.delete(`/upload/batches/${batchId}`)

// ── Analyze ──────────────────────────────────────────────────
export const getDashboard         = (params = {}) => api.get('/analyze/dashboard', { params })
export const getGradeDistribution = (params = {}) => api.get('/analyze/grades',    { params })

// ── Students ─────────────────────────────────────────────────
export const getStudents = (params = {}) => api.get('/students/', { params })
export const getStudent  = (regNo)       => api.get(`/students/${regNo}`)

// ── Arrears ──────────────────────────────────────────────────
export const getArrears = (params = {}) => api.get('/arrears/', { params })

// ── Year-wise ────────────────────────────────────────────────
export const getYearwise = (params = {}) => api.get('/yearwise/', { params })

// ── Class Result Analysis ────────────────────────────────────
export const getClassResult = (params = {}) => api.get('/classresult/', { params })

// ── Export ───────────────────────────────────────────────────
export const exportExcel = (params = {}) => {
  window.open(`/api/v1/export/excel?${new URLSearchParams(params)}`, '_blank')
}
export const exportPDF = (params = {}) => {
  window.open(`/api/v1/export/pdf?${new URLSearchParams(params)}`, '_blank')
}

export default api
