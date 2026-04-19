import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { getDashboard, getGradeDistribution, exportExcel, exportPDF } from '../api'
import { StatCard, LoadingSpinner, ErrorBox, SectionHeader, ProgressBar } from '../components/ui'
import toast from 'react-hot-toast'

const GRADE_COLORS = {
  S:'#7c3aed', O:'#7c3aed', 'A+':'#2563eb', A:'#059669',
  'B+':'#0d9488', B:'#16a34a', 'C+':'#d97706', C:'#b45309',
  U:'#dc2626', SA:'#dc2626', UA:'#ea580c',
}
const PIE_COLORS = ['#16a34a','#dc2626']

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-gray-400 text-xs mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold" style={{ color: p.fill || p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [grades,  setGrades]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [sRes, gRes] = await Promise.all([getDashboard(), getGradeDistribution()])
      setSummary(sRes.data)
      setGrades(gRes.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingSpinner size="lg" label="Loading dashboard…" />
  if (error)   return <ErrorBox message={error} onRetry={fetchData} />

  const passFail = [
    { name: 'Pass', value: summary?.pass_count  || 0 },
    { name: 'Fail', value: summary?.fail_count || 0 },
  ]
  const arrearCatData = (summary?.arrear_categories || []).map(c => ({
    name: c.label, count: c.student_count,
  }))
  const gradeBarData = Object.entries(grades?.class_wise?.grade_counts || {}).map(([g, c]) => ({
    grade: g, count: c, fill: GRADE_COLORS[g] || '#6b7280'
  }))
  const topSubjects = (grades?.subject_wise || [])
    .sort((a, b) => b.fail_percentage - a.fail_percentage).slice(0, 10)
  const yearChartData = Object.entries(summary?.year_split || {}).map(([y, count]) => ({ name: y, count }))

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Dashboard"
        subtitle={`${summary?.total_students ?? 0} students · Nov / Dec 2025 Examination`}
        action={
          <div className="flex gap-2">
            <button onClick={() => { toast.success('Generating…'); exportExcel({}) }} className="btn-secondary text-sm">⬇ Excel</button>
            <button onClick={() => { toast.success('Generating…'); exportPDF({}) }}   className="btn-primary  text-sm">⬇ PDF</button>
          </div>
        }
      />

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Students"  value={summary?.total_students ?? 0}                                              icon="👥" />
        <StatCard label="Pass"            value={summary?.pass_count ?? 0}           color="text-emerald-600"               icon="✅" />
        <StatCard label="With Arrears"    value={summary?.fail_count ?? 0}           color="text-red-600"                   icon="❌" />
        <StatCard label="Pass %"          value={`${(summary?.pass_percentage ?? 0).toFixed(1)}%`} color="text-emerald-600" icon="📈" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Current Students"     value={summary?.current_students     ?? 0} />
        <StatCard label="Past Arrear Students" value={summary?.past_arrear_students ?? 0} color="text-amber-600" />
        <StatCard label="Total Arrears"        value={summary?.total_arrears        ?? 0} color="text-red-600" />
      </div>

      {/* Avg % banner */}
      <div className="card">
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div className="py-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg Percentage</p>
            <p className="text-2xl font-display font-bold text-blue-600">{(summary?.average_percentage ?? 0).toFixed(1)}%</p>
          </div>
          <div className="py-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pass Rate</p>
            <p className="text-2xl font-display font-bold text-emerald-600">{(summary?.pass_percentage ?? 0).toFixed(1)}%</p>
          </div>
          <div className="py-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fail Rate</p>
            <p className="text-2xl font-display font-bold text-red-600">{(summary?.fail_percentage ?? 0).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Pass vs Fail</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={passFail} cx="50%" cy="50%" innerRadius={58} outerRadius={88}
                paddingAngle={3} dataKey="value"
                label={({ name, value, percent }) => `${name}: ${value} (${(percent*100).toFixed(1)}%)`}
                labelLine={false}>
                {passFail.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Arrear Distribution</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={arrearCatData} margin={{ top:5, right:10, left:-20, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grade distribution */}
      {gradeBarData.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Overall Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={gradeBarData} margin={{ top:5, right:10, left:-20, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="grade" tick={{ fill:'#6b7280', fontSize:12, fontFamily:'JetBrains Mono' }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {gradeBarData.map((e,i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hardest subjects */}
      {topSubjects.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-gray-800 mb-5">Most Difficult Subjects (by Fail %)</h3>
          <div className="space-y-3">
            {topSubjects.map(s => (
              <div key={s.subject_code}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-mono font-medium text-gray-700">{s.subject_code}</span>
                  <span className="text-gray-400 text-xs">{s.total_students} students</span>
                </div>
                <ProgressBar value={s.fail_count} max={s.total_students} color="bg-red-500"
                  label={`Fail: ${s.fail_count}  |  Pass: ${s.pass_count}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Year split */}
      {yearChartData.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Students by Year</h3>
          <div className="space-y-3">
            {yearChartData.map(({ name, count }) => (
              <ProgressBar key={name} value={count} max={summary?.total_students||1}
                color="bg-teal-500" label={`${name}: ${count}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
