// ── StatCard ───────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'text-gray-900', icon }) {
  return (
    <div className="stat-card animate-slide-up">
      {icon && <div className="text-2xl mb-1.5 opacity-80">{icon}</div>}
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── LoadingSpinner ──────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', label }) {
  const sz = { sm:'w-5 h-5', md:'w-8 h-8', lg:'w-10 h-10' }[size]
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className={`${sz} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`} />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  )
}

// ── ErrorBox ───────────────────────────────────────────────────
export function ErrorBox({ message, onRetry }) {
  return (
    <div className="card border-red-200 text-center py-10 bg-red-50">
      <p className="text-3xl mb-3">⚠️</p>
      <p className="text-red-700 font-medium text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4 mx-auto text-sm">Retry</button>
      )}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="card text-center py-14 bg-gray-50">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-display font-semibold text-gray-700 text-lg">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── GradeTag ───────────────────────────────────────────────────
const gradeStyles = {
  S:    'bg-violet-100 text-violet-800 border-violet-300',
  O:    'bg-violet-100 text-violet-800 border-violet-300',
  'A+': 'bg-blue-100   text-blue-800   border-blue-300',
  A:    'bg-emerald-100 text-emerald-800 border-emerald-300',
  'B+': 'bg-teal-100   text-teal-800   border-teal-300',
  B:    'bg-green-100  text-green-800  border-green-300',
  'C+': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C:    'bg-amber-100  text-amber-800  border-amber-300',
  U:    'bg-red-100    text-red-800    border-red-300',
  SA:   'bg-red-100    text-red-800    border-red-300',
  UA:   'bg-orange-100 text-orange-800 border-orange-300',
}

export function GradeTag({ grade }) {
  const style = gradeStyles[grade] || 'bg-gray-100 text-gray-700 border-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${style}`}>
      {grade}
    </span>
  )
}

// ── SectionHeader ──────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── ProgressBar ────────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'bg-blue-500', label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span className="font-medium">{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────
export function Divider() {
  return <hr className="border-gray-100 my-4" />
}
