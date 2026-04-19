import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { getClassResult, exportExcel } from '../api'
import { LoadingSpinner, ErrorBox, EmptyState, SectionHeader } from '../components/ui'
import toast from 'react-hot-toast'

// ── Subject name lookup (all ECE R2021 + R2025 subjects) ──────────────────────
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
  GE3751:"Principles of Management",GE3752:"Total Quality Management",
  GE3753:"Engineering Economics and Financial Accounting",
  GE3754:"Human Resource Management",GE3755:"Knowledge Management",
  GE3792:"Industrial Management",
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
  // Professional Electives – Vertical 1: Semiconductor Chip Design and Testing
  CEC363:"Wide Bandgap Devices",CEC361:"Validation and Testing Technology",
  CEC370:"Low Power IC Design",CEC362:"VLSI Testing and Design For Testability",
  CEC342:"Mixed Signal IC Design Testing",CEC334:"Analog IC Design",
  // Vertical 2: Signal Processing
  CEC332:"Advanced Digital Signal Processing",CEC366:"Image Processing",
  CEC356:"Speech Processing",CEC355:"Software Defined Radio",
  CEC337:"DSP Architecture and Programming",CCS338:"Computer Vision",
  // Vertical 3: RF Technologies
  CEC350:"RF Transceivers",CEC353:"Signal Integrity",CEC335:"Antenna Design",
  CEC341:"MICs and RF System Design",CEC338:"EMI/EMC Pre Compliance Testing",
  CEC349:"RFID System Design and Testing",
  // Vertical 4: Bio Medical Technologies
  CBM370:"Wearable Devices",CBM352:"Human Assist Devices",CBM368:"Therapeutic Equipment",
  CBM355:"Medical Imaging Systems",CBM342:"Brain Computer Interface and Applications",
  CBM341:"Body Area Networks",CBM348:"Foundation Skills in Integrated Product Development",
  CBM333:"Assistive Technology",CBM356:"Medical Informatics",
  // Vertical 5: Underwater Technologies
  CEC359:"Underwater Instrumentation System",
  CEC358:"Underwater Imaging Systems and Image Processing",
  CEC357:"Underwater Communication",CEC344:"Ocean Observation Systems",
  CEC360:"Underwater Navigation Systems",CEC343:"Ocean Acoustics",
  // Vertical 6: Sensor Technologies and IoT
  CEC369:"IoT Processors",CEC368:"IoT Based Systems Design",
  CEC365:"Wireless Sensor Network Design",CEC367:"Industrial IoT and Industry 4.0",
  CEC340:"MEMS Design",CEC339:"Fundamentals of Nanoelectronics",
  // Vertical 7: Space Technologies
  CEC347:"Radar Technologies",CEC336:"Avionics Systems",
  CEC346:"Positioning and Navigation Systems",CEC352:"Satellite Communication",
  CEC348:"Remote Sensing",CEC351:"Rocketry and Space Mechanics",
  // Vertical 8: High Speed Communications
  CEC345:"Optical Communication & Networks",CEC364:"Wireless Broad Band Networks",
  CEC331:"4G/5G Communication Networks",CEC354:"Software Defined Networks",
  CEC371:"Massive MIMO Networks",CEC333:"Advanced Wireless Communication Techniques",
  // Open Electives – I
  OAS351:"Space Science",OIE351:"Introduction to Industrial Engineering",
  OBT351:"Food, Nutrition and Health",OCE351:"Environmental and Social Impact Assessment",
  OEE351:"Renewable Energy System",OEI351:"Introduction to Industrial Instrumentation and Control",
  OMA351:"Graph Theory",CCS355:"Neural Networks and Deep Learning",CCW332:"Digital Marketing",
  // Open Electives – II
  OIE352:"Resource Management Techniques",OMG351:"Fintech Regulation",
  OFD351:"Holistic Nutrition",AI3021:"IT in Agricultural System",
  OEI352:"Introduction to Control Engineering",OPY351:"Pharmaceutical Nanotechnology",
  OAE351:"Aviation Management",CCS342:"DevOps",CCS361:"Robotic Process Automation",
  // Open Electives – III
  OHS351:"English for Competitive Examinations",OMG352:"NGOs and Sustainable Development",
  OMG353:"Democracy and Good Governance",CME365:"Renewable Energy Technologies",
  OME354:"Applied Design Thinking",MF3003:"Reverse Engineering",
  OPR351:"Sustainable Manufacturing",AU3791:"Electric and Hybrid Vehicles",
  OAS352:"Space Engineering",OIM351:"Industrial Management",OIE354:"Quality Engineering",
  OSF351:"Fire Safety Engineering",OML351:"Introduction to Non-Destructive Testing",
  OMR351:"Mechatronics",ORA351:"Foundation of Robotics",
  OAE352:"Fundamentals of Aeronautical Engineering",OGI351:"Remote Sensing Concepts",
  OAI351:"Urban Agriculture",OEN351:"Drinking Water Supply and Treatment",
  OEE352:"Electric Vehicle Technology",OEI353:"Introduction to PLC Programming",
  OCH351:"Nano Technology",OCH352:"Functional Materials",OFD352:"Traditional Indian Foods",
  OFD353:"Introduction to Food Processing",OPY352:"IPR for Pharma Industry",
  OTT351:"Basics of Textile Finishing",OTT352:"Industrial Engineering for Garment Industry",
  OTT353:"Basics of Textile Manufacture",
  OPE351:"Introduction to Petroleum Refining and Petrochemicals",
  CPE334:"Energy Conservation and Management",OPT351:"Basics of Plastics Processing",
  OMA352:"Operations Research",OMA353:"Algebra and Number Theory",OMA354:"Linear Algebra",
  OCE353:"Lean Concepts, Tools and Practices",OBT352:"Basics of Microbial Technology",
  OBT353:"Basics of Biomolecules",OBT354:"Fundamentals of Cell and Molecular Biology",
  // Open Electives – IV
  OHS352:"Project Report Writing",OMA355:"Advanced Numerical Methods",
  OMA356:"Random Processes",OMA357:"Queuing and Reliability Modelling",
  OMG354:"Production and Operations Management for Entrepreneurs",
  OMG355:"Multivariate Data Analysis",OME352:"Additive Manufacturing",
  CME343:"New Product Development",OME355:"Industrial Design & Rapid Prototyping Techniques",
  MF3010:"Micro and Precision Engineering",OMF354:"Cost Management of Engineering Projects",
  AU3002:"Batteries and Management System",AU3008:"Sensors and Actuators",
  OAS353:"Space Vehicles",OIM352:"Management Science",OIM353:"Production Planning and Control",
  OIE353:"Operations Management",OSF352:"Industrial Hygiene",OSF353:"Chemical Process Safety",
  OML352:"Electrical, Electronic and Magnetic Materials",
  OML353:"Nanomaterials and Applications",OMR352:"Hydraulics and Pneumatics",OMR353:"Sensors",
  ORA352:"Concepts in Mobile Robots",MV3501:"Marine Propulsion",OMV351:"Marine Merchant Vessels",
  OMV352:"Elements of Marine Engineering",CRA332:"Drone Technologies",
  OGI352:"Geographical Information System",OAI352:"Agriculture Entrepreneurship Development",
  OEN352:"Biodiversity Conservation",OEE353:"Introduction to Control Systems",
  OEI354:"Introduction to Industrial Automation Systems",OCH353:"Energy Technology",
  OCH354:"Surface Science",OFD354:"Fundamentals of Food Engineering",
  OFD355:"Food Safety and Quality Regulations",OPY353:"Nutraceuticals",
  OTT354:"Basics of Dyeing and Printing",FT3201:"Fibre Science",
  OTT355:"Garment Manufacturing Technology",OPE353:"Industrial Safety",
  OPE354:"Unit Operations in Petro Chemical Industries",
  OPT352:"Plastic Materials for Engineers",OPT353:"Properties and Testing of Plastics",
  OCE354:"Basics of Integrated Water Resources Management",
  OBT355:"Biotechnology for Waste Management",OBT356:"Lifestyle Diseases",
  OBT357:"Biotechnology in Health Care",
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function passStyle(pct) {
  if (pct >= 75) return { badge:'bg-green-100 text-green-800 border-green-300', bar:'#16a34a', row:'' }
  if (pct >= 50) return { badge:'bg-yellow-100 text-yellow-800 border-yellow-300', bar:'#d97706', row:'bg-amber-50/30' }
  return { badge:'bg-red-100 text-red-700 border-red-300', bar:'#dc2626', row:'bg-red-50/30' }
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-mono font-bold text-gray-700 mb-2 border-b pb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs mt-1 font-medium" style={{ color: p.fill || p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Year Result Block Component ────────────────────────────────────────────────
function YearBlock({ block, isOpen, onToggle }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('subject_code')
  const [sortDir, setSortDir] = useState('asc')

  const { year_label, semester, class_strength, total_passed,
          total_failed, overall_pass_percentage, subjects } = block

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
    ? <span className="ml-1 text-blue-400 text-xs">{sortDir==='asc'?'▲':'▼'}</span>
    : <span className="ml-1 text-gray-300 text-xs">⇅</span>

  const countHigh = filtered.filter(s => s.pass_percentage >= 75).length
  const countMid  = filtered.filter(s => s.pass_percentage >= 50 && s.pass_percentage < 75).length
  const countLow  = filtered.filter(s => s.pass_percentage < 50).length

  const barData = filtered.slice(0, 15).map(s => ({
    code: s.subject_code,
    'Class Strength': s.class_strength,
    'Appeared':  s.appeared,
    'Passed':    s.passed,
    'Failed':    s.failed,
  }))

  const overallStyle = passStyle(overall_pass_percentage)

  return (
    <div className="card p-0 overflow-hidden shadow-sm">
      {/* Year header — clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#1E3A5F] hover:bg-[#2E5F8A] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-white font-bold text-lg">{year_label}</p>
            <p className="text-blue-200 text-xs mt-0.5">
              Semester {semester} · Nov-Dec Exam · Current Students Only · {subjects?.length || 0} subjects
            </p>
          </div>
          {/* Mini summary badges */}
          <div className="hidden md:flex items-center gap-3 ml-4">
            <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full font-medium">
              Strength: {class_strength}
            </span>
            <span className="bg-emerald-500/30 text-emerald-200 text-xs px-3 py-1 rounded-full font-medium">
              Passed: {total_passed}
            </span>
            {total_failed > 0 && (
              <span className="bg-red-500/30 text-red-200 text-xs px-3 py-1 rounded-full font-medium">
                Failed: {total_failed}
              </span>
            )}
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${
              overall_pass_percentage >= 75 ? 'bg-emerald-500/30 text-emerald-200' :
              overall_pass_percentage >= 50 ? 'bg-amber-500/30 text-amber-200' :
              'bg-red-500/30 text-red-200'
            }`}>
              {overall_pass_percentage.toFixed(2)}%
            </span>
          </div>
        </div>
        <span className="text-white text-xl">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="space-y-0">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
            {[
              { label:'Total Class Strength',    value: class_strength,                          color:'text-gray-900',    bg:'bg-white' },
              { label:'Total Appeared',           value: class_strength,                          color:'text-blue-700',    bg:'bg-blue-50' },
              { label:'Total Pass Strength',      value: total_passed,                            color:'text-emerald-700', bg:'bg-emerald-50' },
              { label:'Pass Percentage',
                value: `${overall_pass_percentage.toFixed(2)}%`,
                color: overall_pass_percentage>=75?'text-emerald-700':overall_pass_percentage>=50?'text-amber-700':'text-red-700',
                bg:    overall_pass_percentage>=75?'bg-emerald-50':overall_pass_percentage>=50?'bg-amber-50':'bg-red-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} px-4 py-4 text-center`}>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Pass rate bar */}
          <div className="px-5 py-3 bg-white border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Current Semester Pass Rate (arrear subjects excluded)</span>
              <span>{overall_pass_percentage.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(overall_pass_percentage,100)}%`,
                  backgroundColor: overallStyle.bar
                }} />
            </div>
          </div>

          {/* Chart */}
          {barData.length > 0 && (
            <div className="px-5 py-4 bg-white border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3 font-medium">
                Subject-wise comparison (top 15 subjects)
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top:5, right:10, left:-10, bottom:50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="code"
                    tick={{ fill:'#6b7280', fontSize:10, fontFamily:'monospace' }}
                    angle={-35} textAnchor="end" />
                  <YAxis tick={{ fill:'#6b7280', fontSize:11 }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize:'12px', paddingTop:'8px' }} />
                  <Bar dataKey="Class Strength" fill="#94a3b8" radius={[3,3,0,0]} />
                  <Bar dataKey="Appeared"       fill="#60a5fa" radius={[3,3,0,0]} />
                  <Bar dataKey="Passed"         fill="#4ade80" radius={[3,3,0,0]} />
                  <Bar dataKey="Failed"         fill="#f87171" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subject table */}
          <div className="border-t border-gray-100">
            {/* Table toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                <span><strong className="text-gray-800">{filtered.length}</strong> subjects</span>
                <span className="text-emerald-700">≥75%: <strong>{countHigh}</strong></span>
                <span className="text-amber-600">50–74%: <strong>{countMid}</strong></span>
                <span className="text-red-600">&lt;50%: <strong>{countLow}</strong></span>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search subject…"
                className="input max-w-xs text-sm py-1.5" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wider">
                    {[
                      ['sno',            'S.No',             'w-8 text-center'],
                      ['subject_code',   'Subject Code',     'min-w-[100px] text-center'],
                      ['subject_name',   'Subject Name',     'min-w-[200px] text-left'],
                      ['class_strength', 'Class Strength',   'min-w-[90px] text-center'],
                      ['appeared',       'Appeared',         'min-w-[80px] text-center'],
                      ['passed',         'Passed',           'min-w-[80px] text-center'],
                      ['failed',         'Failed',           'min-w-[80px] text-center'],
                      ['pass_percentage','Pass %',           'min-w-[100px] text-center'],
                    ].map(([key, label, cls]) => (
                      <th key={key}
                        className={`px-3 py-3 font-semibold border border-[#2E5F8A]
                                    cursor-pointer hover:bg-[#2E86AB] select-none transition-colors ${cls}`}
                        onClick={() => handleSort(key)}>
                        {label}{si(key)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((subj, idx) => {
                    const st = passStyle(subj.pass_percentage)
                    return (
                      <tr key={subj.subject_code}
                        className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                          idx%2===0 ? 'bg-white' : 'bg-[#EAF2FB]/40'
                        } ${st.row}`}>
                        <td className="px-3 py-2.5 text-center text-gray-400 text-xs border-r border-gray-100">
                          {idx+1}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-blue-700 text-xs border-r border-gray-100">
                          {subj.subject_code}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 border-r border-gray-100">
                          {subj.subject_name}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-gray-700 border-r border-gray-100">
                          {subj.class_strength}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-blue-700 border-r border-gray-100">
                          {subj.appeared}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-emerald-700 border-r border-gray-100">
                          {subj.passed}
                        </td>
                        <td className={`px-3 py-2.5 text-center font-bold border-r border-gray-100 ${
                          subj.failed > 0 ? 'text-red-600 bg-red-50/50' : 'text-gray-400'
                        }`}>
                          {subj.failed}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.badge}`}>
                              {subj.pass_percentage.toFixed(2)}%
                            </span>
                            <div className="w-14 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full"
                                style={{ width:`${Math.min(subj.pass_percentage,100)}%`, backgroundColor:st.bar }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Footer summary — AU format */}
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-[#1E3A5F]">
                    <td colSpan={3} className="px-4 py-2.5 text-right font-bold text-[#1E3A5F] text-sm">
                      Total No. of Class Strength
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-[#1E3A5F] text-xl border-l-2 border-[#1E3A5F]">
                      {class_strength}
                    </td>
                    <td colSpan={4} />
                  </tr>
                  <tr className="bg-emerald-50">
                    <td colSpan={3} className="px-4 py-2.5 text-right font-bold text-emerald-800 text-sm">
                      Total No. of Pass Strength
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-700 text-xl border-l-2 border-emerald-400">
                      {total_passed}
                    </td>
                    <td colSpan={4} />
                  </tr>
                  <tr className={`border-b-2 border-[#1E3A5F] ${
                    overall_pass_percentage>=75?'bg-emerald-50':
                    overall_pass_percentage>=50?'bg-amber-50':'bg-red-50'}`}>
                    <td colSpan={3} className="px-4 py-2.5 text-right font-bold text-gray-700 text-sm">
                      Pass Percentage (Current Semester Only)
                    </td>
                    <td className={`px-3 py-2.5 text-center font-bold text-2xl border-l-2 ${
                      overall_pass_percentage>=75?'text-emerald-700 border-emerald-400':
                      overall_pass_percentage>=50?'text-amber-700 border-amber-400':
                      'text-red-700 border-red-400'}`}>
                      {overall_pass_percentage.toFixed(2)}%
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassResultAnalysis() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [openYear, setOpenYear] = useState({
    '1st Year': true, '2nd Year': true, '3rd Year': true, '4th Year': true
  })

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getClassResult({})
      setData(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const blocks = data?.year_blocks ?? []

  const toggleYear = yr => setOpenYear(prev => ({ ...prev, [yr]: !prev[yr] }))
  const toggleAll  = open => {
    const next = {}
    blocks.forEach(b => { next[b.year_label] = open })
    setOpenYear(next)
  }

  return (
    <div className="space-y-5 animate-fade-in">

      <SectionHeader
        title="Class Result Analysis"
        subtitle="Year-wise · Current students only · Nov-Dec Examination · Odd Semester subjects only (Sem 1, 3, 5, 7)"
        action={
          <div className="flex gap-2">
            <button onClick={() => { toast.success('Generating Excel…'); exportExcel({}) }}
              className="btn-secondary text-sm">⬇ Excel</button>
          </div>
        }
      />

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm">
        <p className="font-semibold text-blue-800 mb-1">📅 Nov-Dec Examination — Odd Semester Analysis</p>
        <div className="text-blue-700 space-y-0.5 text-xs">
          <p>✅ <strong>Includes:</strong> Current students · Odd semester subjects only (Sem 1, 3, 5, 7)</p>
          <p>❌ <strong>Excludes:</strong> Even semester subjects · Past arrear students · WC / WD withheld grades</p>
          <p>📊 <strong>Pass %:</strong> Calculated using current odd-semester subject grades only</p>
          <p>🔄 <strong>To switch to Apr-May exam:</strong> Change <code className="bg-blue-100 px-1 rounded">CURRENT_EXAM_CYCLE_NAME = "APR_MAY"</code> in <code className="bg-blue-100 px-1 rounded">backend/app/core/constants.py</code></p>
        </div>
      </div>

      {loading ? <LoadingSpinner size="lg" label="Loading class result analysis…" />
      : error   ? <ErrorBox message={error} onRetry={fetchData} />
      : blocks.length === 0 ? (
        <EmptyState icon="📊" title="No current student data" subtitle="Upload a result PDF to see class analysis." />
      ) : (
        <>
          {/* Expand / Collapse all */}
          <div className="flex justify-end gap-2">
            <button onClick={() => toggleAll(true)}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
              Expand All
            </button>
            <button onClick={() => toggleAll(false)}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
              Collapse All
            </button>
          </div>

          {/* One block per year */}
          {blocks.map(block => (
            <YearBlock
              key={block.year_label}
              block={block}
              isOpen={openYear[block.year_label] ?? true}
              onToggle={() => toggleYear(block.year_label)}
            />
          ))}

          {/* Colour legend */}
          <div className="card py-3 px-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Pass % Colour Guide</p>
            <div className="flex gap-5 flex-wrap text-xs">
              {[
                ['bg-green-100 border-green-300','text-green-800','≥ 75%  — Good'],
                ['bg-yellow-100 border-yellow-300','text-amber-700','50–74% — Average'],
                ['bg-red-100 border-red-300','text-red-700','< 50%  — Needs Attention'],
              ].map(([bg, tc, label]) => (
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
