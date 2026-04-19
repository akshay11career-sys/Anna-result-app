import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadPDF, getBatchStatus, listBatches, deleteBatch } from '../api'
import { SectionHeader } from '../components/ui'
import toast from 'react-hot-toast'

const STATUS_META = {
  pending:    { color: 'text-amber-600  bg-amber-50  border-amber-200',    icon: '⏳', label: 'Pending'    },
  processing: { color: 'text-blue-600   bg-blue-50   border-blue-200',     icon: '⚙️', label: 'Processing' },
  done:       { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: '✅', label: 'Done'       },
  error:      { color: 'text-red-600    bg-red-50    border-red-200',      icon: '❌', label: 'Error'       },
}

export default function UploadPage() {
  const [file,       setFile]       = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [batches,    setBatches]    = useState([])
  const [pollingId,  setPollingId]  = useState(null)
  const [deletingId, setDeletingId] = useState(null)   // which batch is being deleted
  const [confirmId,  setConfirmId]  = useState(null)   // which batch is awaiting confirm

  const fetchBatches = useCallback(async () => {
    try { setBatches((await listBatches()).data) } catch {}
  }, [])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  // Poll processing status
  useEffect(() => {
    if (!pollingId) return
    const iv = setInterval(async () => {
      try {
        const { data } = await getBatchStatus(pollingId)
        setBatches(prev =>
          prev.map(b => b.batch_id === pollingId ? { ...b, ...data, batch_id: data.batch_id } : b)
        )
        if (data.status === 'done') {
          toast.success(`✅ ${data.total_students} students processed`)
          setPollingId(null); clearInterval(iv)
        } else if (data.status === 'error') {
          toast.error(`Failed: ${data.error}`)
          setPollingId(null); clearInterval(iv)
        }
      } catch { clearInterval(iv); setPollingId(null) }
    }, 2000)
    return () => clearInterval(iv)
  }, [pollingId])

  const onDrop = useCallback(acc => { if (acc[0]) setFile(acc[0]) }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file) { toast.error('Select a PDF first'); return }
    setUploading(true)
    try {
      const { data } = await uploadPDF(file, 1)
      toast.success('Uploaded! Processing started…')
      await fetchBatches()
      setPollingId(data.batch_id)
      setFile(null)
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`)
    } finally { setUploading(false) }
  }

  // ── Delete a single batch ──────────────────────────
  const handleDelete = async (batchId) => {
    setDeletingId(batchId)
    try {
      await deleteBatch(batchId)
      setBatches(prev => prev.filter(b => b.batch_id !== batchId))
      toast.success('Batch deleted — all associated student records removed.')
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`)
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  // ── Delete ALL batches ─────────────────────────────
  const handleDeleteAll = async () => {
    const ids = batches.map(b => b.batch_id)
    for (const id of ids) {
      try { await deleteBatch(id) } catch {}
    }
    setBatches([])
    setConfirmId(null)
    toast.success('All upload history cleared.')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <SectionHeader
        title="Upload Results"
        subtitle="Semester, regulation, and student classification are detected automatically"
      />

      {/* Upload card */}
      <div className="card space-y-5">
        <div {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
            ${isDragActive ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                           : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
            ${file ? 'border-emerald-400 bg-emerald-50' : ''}`}>
          <input {...getInputProps()} />
          {file ? (
            <div>
              <div className="text-4xl mb-2">📄</div>
              <p className="font-semibold text-emerald-700">{file.name}</p>
              <p className="text-sm text-gray-400 mt-1">{(file.size/1024/1024).toFixed(2)} MB · Click or drag to replace</p>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-3 opacity-20">📑</div>
              <p className="font-semibold text-gray-700">
                {isDragActive ? 'Drop the PDF here…' : 'Drag & drop your result PDF'}
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse · Max 50 MB</p>
            </div>
          )}
        </div>

        {/* Auto-detect info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm space-y-1.5">
          <p className="font-semibold text-blue-800 mb-1">Auto-detected from PDF</p>
          <p className="text-blue-700">📅 Semester — read from each page header</p>
          <p className="text-blue-700">🎓 Regulation — from register numbers (R2021 / R2025)</p>
          <p className="text-blue-700">👥 Current vs Past Arrear — matched against batch ranges</p>
          <p className="text-blue-700">🔢 Results sorted by register number</p>
        </div>

        <button onClick={handleUpload} disabled={uploading || !file} className="btn-primary w-full py-3 text-base">
          {uploading ? '⏳ Uploading…' : '⬆ Upload & Process PDF'}
        </button>
      </div>

      {/* Grade reference */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'R2021', grades: ['O=10','A+=9','A=8','B+=7','B=6','C=5','U=0'] },
          { label: 'R2025', grades: ['S=10','A+=9','A=8','B+=7','B=6.5','C+=6','C=5','U=0'] },
        ].map(({ label, grades }) => (
          <div key={label} className="card py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">{label} Grade Points</p>
            <div className="flex flex-wrap gap-1.5">
              {grades.map(g => (
                <span key={g} className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">{g}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Upload History ─────────────────────────────── */}
      {batches.length > 0 && (
        <div className="card">

          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              Upload History
              <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
              </span>
            </h3>

            {/* Delete All button */}
            {confirmId === 'all' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Delete all history?</span>
                <button
                  onClick={handleDeleteAll}
                  className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Yes, delete all
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId('all')}
                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium transition-colors"
              >
                🗑 Clear All History
              </button>
            )}
          </div>

          {/* ⚠️ Warning banner if multiple batches exist */}
          {batches.filter(b => b.status === 'done').length > 1 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm">
              <span className="text-lg shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">Multiple batches detected</p>
                <p className="text-amber-700 mt-0.5">
                  The dashboard and analytics include data from <strong>all</strong> batches listed below.
                  Delete any old batches you no longer need so only the current result appears in the analysis.
                </p>
              </div>
            </div>
          )}

          {/* Batch rows */}
          <div className="space-y-2">
            {batches.map(b => {
              const meta = STATUS_META[b.status] || STATUS_META.pending
              const isDeleting = deletingId === b.batch_id
              const isConfirming = confirmId === b.batch_id

              return (
                <div key={b.batch_id}
                  className="border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">

                  <div className="flex items-center justify-between gap-3">

                    {/* Left: icon + info */}
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <span className="text-lg shrink-0">{meta.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{b.filename}</p>
                        <p className="text-xs text-gray-400">
                          {b.uploaded_at ? new Date(b.uploaded_at).toLocaleString() : '—'}
                          {b.total_students > 0 && ` · ${b.total_students} students`}
                        </p>
                      </div>
                    </div>

                    {/* Right: status + delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>

                      {b.status === 'processing' && (
                        <div className="w-4 h-4 border border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      )}

                      {/* Delete button — only for done/error batches */}
                      {b.status !== 'processing' && b.status !== 'pending' && (
                        isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-red-600">Delete?</span>
                            <button
                              onClick={() => handleDelete(b.batch_id)}
                              disabled={isDeleting}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(b.batch_id)}
                            className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded font-medium transition-colors"
                            title="Delete this batch and all its student records"
                          >
                            🗑 Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Error message if applicable */}
                  {b.status === 'error' && b.error && (
                    <p className="text-xs text-red-500 mt-2 ml-9">{b.error}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            ⓘ Deleting a batch permanently removes all student records and subject results associated with it.
            The dashboard will immediately reflect the updated data.
          </p>
        </div>
      )}
    </div>
  )
}
