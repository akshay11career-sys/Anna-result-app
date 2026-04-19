import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import { getYearwise } from '../api'
import { LoadingSpinner, ErrorBox, EmptyState, SectionHeader, ProgressBar } from '../components/ui'

// ── Subject name lookup ────────────────────────────────────────────────────────
const SUBJECT_DB = {
  IP3151:"Induction Programme",HS3152:"Professional English I",MA3151:"Matrices and Calculus",
  PH3151:"Engineering Physics",CY3151:"Engineering Chemistry",
  GE3151:"Problem Solving and Python Programming",GE3152:"Heritage of Tamils",
  GE3171:"Python Programming Laboratory",BS3171:"Physics and Chemistry Laboratory",
  GE3172:"English Laboratory",HS3252:"Professional English II",
  MA3251:"Statistics and Numerical Methods",PH3254:"Physics for Electronics Engineering",
  BE3254:"Electrical and Instrumentation Engineering",GE3251:"Engineering Graphics",
  EC3251:"Circuit Analysis",GE3252:"Tamils and Technology",
  GE3271:"Engineering Practices Laboratory",EC3271:"Circuits Analysis Laboratory",
  GE3272:"Communication Laboratory",MA3355:"Random Processes and Linear Algebra",
  CS3353:"C Programming and Data Structures",EC3354:"Signals and Systems",
  EC3353:"Electronic Devices and Circuits",EC3351:"Control Systems",
  EC3352:"Digital Systems Design",EC3361:"Electronic Devices and Circuits Laboratory",
  CS3362:"C Programming and Data Structures Laboratory",GE3361:"Professional Development",
  EC3452:"Electromagnetic Fields",EC3401:"Networks and Security",
  EC3451:"Linear Integrated Circuits",EC3492:"Digital Signal Processing",
  EC3491:"Communication Systems",GE3451:"Environmental Sciences and Sustainability",
  EC3461:"Communication Systems Laboratory",EC3462:"Linear Integrated Circuits Laboratory",
  EC3501:"Wireless Communication",EC3552:"VLSI and Chip Design",
  EC3551:"Transmission Lines and RF Systems",EC3561:"VLSI Laboratory",
  ET3491:"Embedded Systems and IoT Design",CS3491:"Artificial Intelligence and Machine Learning",
  GE3791:"Human Values and Ethics",EC3711:"Summer Internship",EC3811:"Project Work",
  // R2025
  MA25C01:"Applied Calculus",EN25C01:"English Essentials I",UC25H01:"Heritage of Tamils",
  EE25C04:"Basic Electronics and Electrical Engineering",PH25C01:"Applied Physics I",
  CY25C01:"Applied Chemistry I",CS25C01:"Computer Programming C",ME25C04:"Makerspace",
  UC25A01:"Life Skills for Engineers I",UC25A02:"Physical Education I",
  MA25C02:"Linear Algebra",UC25H02:"Tamils and Technology",EN25C02:"English Essentials II",
  EC25C01:"Electron Devices",EC25C02:"Circuits and Network Analysis",
  CS25C05:"Data Structures using C++",ME25C05:"Re-Engineering for Innovation",
  UC25A03:"Life Skills for Engineers II",EC25C03:"Devices and Circuits Laboratory",
  UC25A04:"Physical Education II",
}

const YEAR_COLORS = { '1st Year':'#2563eb','2nd Year':'#059669','3rd Year':'#d97706','4th Year':'#7c3aed' }
const GRADE_COLORS = {
  S:'#7c3aed',O:'#7c3aed','A+':'#2563eb',A:'#059669',
  'B+':'#0d9488',B:'#16a34a','C+':'#d97706',C:'#b45309',
  U:'#dc2626',SA:'#dc2626',UA:'#ea580c',
}
const GRADE_ORDER = ['S','O','A+','A','B+','B','C+','C','U','SA','UA']

function passStyle(pct) {
  if (pct >= 75) return { badge:'bg-green-100 text-green-800 border-green-300', bar:'#16a34a' }
  if (pct >= 50) return { badge:'bg-yellow-100 text-yellow-800 border-yellow-300', bar:'#d97706' }
  return  { badge:'bg-red-100 text-red-700 border-red-300', bar:'#dc2626' }
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold" style={{ color:p.fill||p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ── Subject table for one year ─────────────────────────────────────────────────
function SubjectTable({ subjects, classStrength }) {
  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState('subject_code')
  const [sortDir, setSortDir] = useState('asc')

  const enriched = (subjects || []).map(s => ({
    ...s,
    subject_name: (s.subject_name && s.subject_name.trim())
      ? s.subject_name
      : (SUBJECT_DB[s.subject_code] || s.subject_code),
  }))

  const filtered = enriched
    .filter(s => !search ||
      s.subject_code.toLowerCase().includes(search.toLowerCase()) ||
      s.subject_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  const handleSort = k => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }
  const si = k => sortKey === k
    ? <span className="ml-1 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
    : <span className="ml-1 text-gray-300 text-xs">⇅</span>

  if (!filtered.length) return (
    <p className="text-sm text-gray-400 italic px-4 py-3">
      No current-semester subject data available.
    </p>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-wrap gap-2">
        <p className="text-xs text-gray-500 font-medium">
          {filtered.length} subjects &nbsp;·&nbsp; Class Strength: <strong>{classStrength}</strong>
          &nbsp;·&nbsp; This semester's subjects (arrear subjects excluded)
        </p>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search subject…"
          className="input text-sm py-1.5 max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wider">
              {[
                ['sno',            'S.No',            'w-8 text-center'],
                ['subject_code',   'Subject Code',    'min-w-[105px] text-center'],
                ['subject_name',   'Subject Name',    'min-w-[200px] text-left'],
                ['class_strength', 'Class Strength',  'min-w-[90px] text-center'],
                ['appeared',       'Appeared',        'min-w-[82px] text-center'],
                ['passed',         'Passed',          'min-w-[82px] text-center'],
                ['failed',         'Failed',          'min-w-[82px] text-center'],
                ['pass_percentage','Pass %',          'min-w-[100px] text-center'],
              ].map(([key, label, cls]) => (
                <th key={key}
                  className={`px-3 py-3 font-semibold border border-[#2E5F8A]
                              cursor-pointer hover:bg-[#2E86AB] select-none ${cls}`}
                  onClick={() => handleSort(key)}>
                  {label}{si(key)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((s, idx) => {
              const st = passStyle(s.pass_percentage)
              return (
                <tr key={s.subject_code}
                  className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-[#EAF2FB]/40'
                  }`}>
                  <td className="px-3 py-2 text-center text-gray-400 text-xs border-r border-gray-100">{idx+1}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-blue-700 text-xs border-r border-gray-100">
                    {s.subject_code}
                  </td>
                  <td className="px-3 py-2 text-gray-800 border-r border-gray-100">{s.subject_name}</td>
                  <td className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-100">
                    {s.class_strength}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-blue-700 border-r border-gray-100">
                    {s.appeared}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-emerald-700 border-r border-gray-100">
                    {s.passed}
                  </td>
                  <td className={`px-3 py-2 text-center font-bold border-r border-gray-100 ${
                    s.failed > 0 ? 'text-red-600 bg-red-50/50' : 'text-gray-400'
                  }`}>
                    {s.failed}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.badge}`}>
                        {s.pass_percentage.toFixed(2)}%
                      </span>
                      <div className="w-14 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full"
                          style={{ width:`${Math.min(s.pass_percentage,100)}%`, backgroundColor:st.bar }} />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Summary footer — AU format */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-[#1E3A5F]">
              <td colSpan={3} className="px-4 py-2.5 text-right font-bold text-[#1E3A5F] text-sm">
                Class Strength
              </td>
              <td className="px-3 py-2.5 text-center font-bold text-[#1E3A5F] text-xl border-l-2 border-[#1E3A5F]">
                {classStrength}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Year card component ────────────────────────────────────────────────────────
function YearCard({ y, color, gradeData }) {
  const [showSubjects, setShowSubjects] = useState(false)

  const gradeBarData = Object.entries(y.grade_distribution || {})
    .filter(([,v]) => v > 0)
    .sort((a,b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0]))
    .map(([g, cnt]) => ({ grade:g, count:cnt, fill: GRADE_COLORS[g]||'#6b7280' }))

  const subjectCount = (y.subject_analysis || []).length
  const classStrength = y.subject_analysis?.[0]?.class_strength ?? y.total_students

  return (
    <div className="card p-0 overflow-hidden shadow-sm">
      {/* Year header */}
      <div className="px-5 py-4 border-b border-gray-100" style={{ borderLeft:`4px solid ${color}` }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-gray-900 text-lg">{y.year_label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{y.total_students} total students</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge badge-pass">{y.pass_count} passed</span>
            <span className="badge badge-fail">{y.fail_count} failed</span>
            <span className={`badge text-xs font-bold ${
              y.pass_percentage >= 75 ? 'badge-pass' :
              y.pass_percentage >= 50 ? 'badge-warn' : 'badge-fail'
            }`}>{y.pass_percentage.toFixed(1)}% pass rate</span>
          </div>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 bg-gray-50/50">
        {[
          { label:'Total Students',   value: y.total_students,                         color:'text-gray-900' },
          { label:'Passed',           value: y.pass_count,                             color:'text-emerald-700' },
          { label:'Failed / Arrear',  value: y.fail_count,                             color:'text-red-600' },
          { label:'Avg Percentage',   value: `${y.average_percentage.toFixed(1)}%`,    color:'text-blue-700' },
        ].map(stat => (
          <div key={stat.label} className="px-4 py-3 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pass rate bar */}
      <div className="px-5 py-3 bg-white border-t border-gray-100">
        <ProgressBar
          value={y.pass_count}
          max={y.total_students}
          color={y.pass_percentage >= 75 ? 'bg-emerald-500' : y.pass_percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}
          label={`Pass Rate: ${y.pass_percentage.toFixed(1)}%`}
        />
      </div>

      {/* Grade distribution chart */}
      {gradeBarData.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Grade Distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={gradeBarData} margin={{ top:5, right:10, left:-20, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="grade" tick={{ fill:'#6b7280', fontSize:12, fontFamily:'monospace' }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {gradeBarData.map((e,i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subject-wise analysis toggle */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowSubjects(!showSubjects)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-800">
              Subject-wise Result Analysis
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {subjectCount} subjects · arrear subjects excluded
            </span>
          </div>
          <span className="text-gray-400 text-lg transition-transform duration-200"
            style={{ transform: showSubjects ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </button>

        {showSubjects && (
          <div className="border-t border-gray-100">
            {subjectCount > 0 ? (
              <SubjectTable
                subjects={y.subject_analysis}
                classStrength={classStrength}
              />
            ) : (
              <p className="text-sm text-gray-400 italic px-5 py-4">
                No subject data found for this year. Upload a result PDF to see the breakdown.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function YearwiseAnalysis() {
  const [sel,      setSel]      = useState('All Years')
  const [yearData, setYearData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const YEAR_OPTIONS = ['All Years','1st Year','2nd Year','3rd Year','4th Year']

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    const params = {}
    if (sel !== 'All Years') params.year_label = sel
    try {
      const res = await getYearwise(params)
      setYearData(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [sel])

  useEffect(() => { fetchData() }, [fetchData])

  const years = yearData?.years || []

  // Overview chart data (shown only in All Years mode)
  const overviewData = years.map(y => ({
    name: y.year_label.replace(' Year',''),
    'Total': y.total_students,
    'Passed': y.pass_count,
    'Failed': y.fail_count,
  }))
  const yearColors = ['#2563eb','#059669','#d97706','#7c3aed']

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Year-wise Analysis"
        subtitle="Overall results + subject-wise breakdown (current semester subjects only)"
      />

      {/* Year filter */}
      <div className="card py-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Filter by Year</p>
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map(yr => (
            <button key={yr} onClick={() => setSel(yr)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                sel === yr
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}>
              {yr}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading year-wise analysis…" />
      : error   ? <ErrorBox message={error} onRetry={fetchData} />
      : years.length === 0 ? (
        <EmptyState icon="📅" title="No data" subtitle="Upload a PDF first." />
      ) : (
        <>
          {/* Overview bar chart — only when showing all years */}
          {sel === 'All Years' && overviewData.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">All Years — Overview</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={overviewData} margin={{ top:5, right:20, left:-10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fill:'#6b7280', fontSize:13 }} />
                  <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ color:'#6b7280', fontSize:'12px' }} />
                  <Bar dataKey="Total"  fill="#94a3b8" radius={[4,4,0,0]} />
                  <Bar dataKey="Passed" fill="#4ade80" radius={[4,4,0,0]} />
                  <Bar dataKey="Failed" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* One card per year */}
          {years.map((y, i) => (
            <YearCard
              key={y.year_label}
              y={y}
              color={YEAR_COLORS[y.year_label] || yearColors[i]}
              gradeData={yearData}
            />
          ))}

          {/* Colour legend */}
          <div className="card py-3 px-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Pass % Colour Guide</p>
            <div className="flex gap-5 flex-wrap text-xs">
              {[
                ['bg-green-100 border-green-300','text-green-800','≥ 75% — Good'],
                ['bg-yellow-100 border-yellow-300','text-amber-700','50–74% — Average'],
                ['bg-red-100 border-red-300','text-red-700','< 50% — Needs Attention'],
              ].map(([bg,tc,label]) => (
                <span key={label} className="flex items-center gap-2">
                  <span className={`inline-block w-10 h-3 rounded border ${bg}`} />
                  <span className={`${tc} font-medium`}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
