import { useState, useEffect, useCallback } from 'react'
import { getStudents, getStudent } from '../api'
import { LoadingSpinner, ErrorBox, EmptyState, SectionHeader, GradeTag } from '../components/ui'
import toast from 'react-hot-toast'

function StudentModal({ regNo, onClose }) {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudent(regNo)
      .then(r => setStudent(r.data))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [regNo])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-xl text-gray-900">{student?.name || regNo}</h2>
            <p className="text-gray-400 text-sm font-mono mt-0.5">{student?.register_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl p-1 transition-colors">✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {loading ? <LoadingSpinner size="md" /> : student ? (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-reg">{student.regulation}</span>
                <span className="badge badge-reg">Semester {student.semester}</span>
                <span className="badge badge-reg">{student.year_label}</span>
                {student.arrear_count === 0
                  ? <span className="badge badge-pass">All Pass</span>
                  : <span className="badge badge-fail">{student.arrear_count} Arrear{student.arrear_count>1?'s':''}</span>}
                <span className={`badge ${student.is_current_student ? 'badge-pass' : 'badge-warn'}`}>
                  {student.is_current_student ? 'Current Student' : 'Past Arrear'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:'Percentage', value:`${student.percentage?.toFixed(2)||0}%`, color:'text-blue-700' },
                  { label:'Subjects',   value:student.total_subjects,                   color:'text-gray-800' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</p>
                    <p className={`font-display font-bold text-xl mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Subject Results</p>
                <div className="table-wrapper">
                  <table className="table">
                    <thead><tr><th>Code</th><th>Subject Name</th><th>Grade</th></tr></thead>
                    <tbody>
                      {(student.subject_results || []).map(sr => (
                        <tr key={sr.subject_code} className={sr.is_arrear ? 'bg-red-50' : ''}>
                          <td className="font-mono text-xs font-medium">{sr.subject_code}</td>
                          <td className="text-gray-500 text-xs">{sr.subject_name || '—'}</td>
                          <td><GradeTag grade={sr.grade} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <p className="text-gray-400 text-sm">Student not found.</p>}
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 50

export default function StudentAnalysis() {
  const [search,   setSearch]   = useState('')
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [selected, setSelected] = useState(null)
  const [page,     setPage]     = useState(0)
  const [total,    setTotal]    = useState(0)

  const fetchStudents = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE }
      if (search.trim()) params.search = search.trim()
      const { data } = await getStudents(params)
      setStudents(data)
      setTotal(data.length)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { setPage(0); const t = setTimeout(fetchStudents, 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { fetchStudents() }, [page])

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Student Analysis" subtitle={`${students.length} students shown`} />

      {/* Search */}
      <div className="card py-4">
        <input
          type="text"
          className="input"
          placeholder="Search by register number or name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
      </div>

      {loading ? (
        <LoadingSpinner label="Loading students…" />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchStudents} />
      ) : students.length === 0 ? (
        <EmptyState icon="🔍" title="No students found" subtitle="Try a different search term or upload a PDF." />
      ) : (
        <>
          <div className="table-wrapper card p-0 overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Register No</th>
                  <th>Name</th>
                  <th>Regulation</th>
                  <th>Sem</th>
                  <th>Year</th>
                  <th>Subjects</th>
                  <th>Arrears</th>
                  <th>Percentage</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setSelected(s.register_number)}>
                    <td className="font-mono text-xs text-blue-600 hover:underline">{s.register_number}</td>
                    <td className="font-medium">{s.name}</td>
                    <td><span className="badge badge-reg">{s.regulation}</span></td>
                    <td className="text-gray-500">{s.semester}</td>
                    <td className="text-gray-500 text-xs">{s.year_label}</td>
                    <td className="text-gray-500">{s.total_subjects}</td>
                    <td>
                      {s.arrear_count === 0
                        ? <span className="badge badge-pass">0</span>
                        : <span className="badge badge-fail">{s.arrear_count}</span>}
                    </td>
                    <td className={`font-mono text-sm font-semibold ${
                      s.percentage >= 75 ? 'text-emerald-600' :
                      s.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.percentage?.toFixed(1)}%
                    </td>
                    <td>
                      <span className={`badge text-xs ${s.is_current_student ? 'badge-pass' : 'badge-warn'}`}>
                        {s.is_current_student ? 'Current' : 'Past Arrear'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center items-center gap-4">
            <button className="btn-secondary text-sm" disabled={page===0} onClick={() => setPage(p=>p-1)}>← Prev</button>
            <span className="text-sm text-gray-500">Page {page+1}</span>
            <button className="btn-secondary text-sm" disabled={students.length<PAGE_SIZE} onClick={() => setPage(p=>p+1)}>Next →</button>
          </div>
        </>
      )}

      {selected && <StudentModal regNo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
