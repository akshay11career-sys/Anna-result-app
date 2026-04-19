import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',       icon: '▦' },
  { to: '/upload',    label: 'Upload PDF',       icon: '↑' },
  { to: '/students',  label: 'Student Analysis', icon: '◎' },
  { to: '/arrears',   label: 'Arrear Analysis',  icon: '⚠' },
  { to: '/yearwise',  label: 'Year-wise',        icon: '◫' },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/upload':    'Upload PDF',
  '/students':  'Student Analysis',
  '/arrears':   'Arrear Analysis',
  '/yearwise':  'Year-wise Analysis',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Dashboard'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`flex flex-col shrink-0 transition-all duration-300
                         bg-white border-r border-gray-200 shadow-sm
                         ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-display font-bold">A</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden leading-tight">
              <p className="text-gray-900 font-display font-bold text-sm">Anna University</p>
              <p className="text-gray-400 text-xs">Result Analyzer</p>
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }>
              <span className="text-base leading-none shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)}
          className="mx-2 mb-3 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all text-xs">
          {collapsed ? '▶' : '◀'}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
          <h1 className="text-base font-display font-semibold text-gray-800">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="badge badge-reg text-xs">ECE · 9100</span>
            <span className="badge badge-pass text-xs">Nov/Dec 2025</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
