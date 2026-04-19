import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getArrears } from '../api'
import { LoadingSpinner, ErrorBox, EmptyState, SectionHeader, GradeTag } from '../components/ui'

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold text-gray-800">Failures: {payload[0]?.value}</p>
    </div>
  )
}

export default function ArrearAnalysis() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData((await getArrears()).data) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const chartData = (data?.most_repeated_subjects || []).map(s => ({
    name: s.subject_code, count: s.fail_count,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Arrear Analysis"
        subtitle="Students with pending arrears and failure trends by subject"
      />

      {loading ? <LoadingSpinner label="Loading…" /> : error ? <ErrorBox message={error} onRetry={fetchData} /> : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card text-center">
              <p className="stat-label">Students with Arrears</p>
              <p className="stat-value text-red-600">{data?.total_arrear_students ?? 0}</p>
            </div>
            <div className="card text-center">
              <p className="stat-label">Total Arrear Count</p>
              <p className="stat-value text-orange-600">{data?.total_arrear_count ?? 0}</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <h3 className="font-display font-semibold text-gray-800 mb-4">Most Failed Subjects (Top 10)</h3>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={chartData} margin={{ top:5, right:10, left:-15, bottom:42 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fill:'#6b7280', fontSize:10, fontFamily:'JetBrains Mono' }}
                    angle={-35} textAnchor="end" />
                  <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {chartData.map((_,i) => <Cell key={i} fill={`hsl(${210+i*12},70%,52%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Student list */}
          {!data?.arrear_students?.length ? (
            <EmptyState icon="🎉" title="No arrear students" subtitle="All students passed!" />
          ) : (
            <div className="card">
              <h3 className="font-display font-semibold text-gray-800 mb-4">
                Arrear Students
                <span className="ml-2 text-sm font-normal text-gray-400">({data.total_arrear_students})</span>
              </h3>

              <div className="space-y-2">
                {data.arrear_students.map(s => (
                  <div key={s.register_number} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3
                                 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => setExpanded(expanded === s.register_number ? null : s.register_number)}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-gray-800 text-sm">{s.name}</span>
                        <span className="text-xs font-mono text-gray-400">{s.register_number}</span>
                        <span className="badge badge-reg">{s.regulation}</span>
                        <span className="text-xs text-gray-400">Sem {s.semester}</span>
                        <span className={`badge text-xs ${s.is_current_student ? 'badge-pass' : 'badge-warn'}`}>
                          {s.is_current_student ? 'Current' : 'Past Arrear'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="badge badge-fail">{s.arrear_count} arrear{s.arrear_count>1?'s':''}</span>
                        <span className="text-gray-300 text-xs">{expanded===s.register_number?'▲':'▼'}</span>
                      </div>
                    </button>

                    {expanded === s.register_number && (
                      <div className="px-4 pb-3 pt-1 bg-red-50 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(s.failed_subjects||[]).map(subj => (
                            <div key={subj.subject_code}
                              className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-1.5">
                              <span className="text-xs font-mono text-gray-600">{subj.subject_code}</span>
                              <GradeTag grade={subj.grade} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
