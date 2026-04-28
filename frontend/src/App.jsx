import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarDays, Shield, LogOut, ClipboardList, Settings, AlertTriangle } from 'lucide-react'
import { AuthProvider, useAuth, useRole } from './api/auth.jsx'
import LoginPage    from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import PlanPage     from './pages/PlanPage.jsx'
import AdminPage    from './pages/AdminPage.jsx'
import ActivityPage  from './pages/ActivityPage.jsx'
import SettingsPage       from './pages/SettingsPage.jsx'
import ErrorsPage         from './pages/ErrorsPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'

const getToday = () => format(new Date(), 'yyyy-MM-dd')

// ── Защищённый маршрут ──────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

// ── Навигация ───────────────────────────────────────────────
function Navbar() {
  const { user, logout } = useAuth()
  const { isSuper }      = useRole()
  const navigate         = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <NavLink
            to={`/plan/${getToday()}`}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <CalendarDays className="w-4 h-4" />
            План
          </NavLink>

          {isSuper && (
            <NavLink
              to="/activity"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-gray-100 text-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <ClipboardList className="w-4 h-4" />
              Журнал
            </NavLink>
          )}
          {isSuper && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-gray-100 text-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Settings className="w-4 h-4" />
              Настройки
            </NavLink>
          )}
          {isSuper && (
            <NavLink
              to="/errors"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <AlertTriangle className="w-4 h-4" />
              Ошибки
            </NavLink>
          )}
          {isSuper && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Shield className="w-4 h-4" />
              Доступ
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:block">{user.name}</span>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}

// ── Приложение ──────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ForgotPasswordPage />} />

          <Route path="/" element={
            <RequireAuth>
              <Navigate to={`/plan/${getToday()}`} replace />
            </RequireAuth>
          } />

          <Route path="/plan/:date?" element={
            <RequireAuth><PlanPage /></RequireAuth>
          } />

          <Route path="/admin" element={
            <RequireAuth><AdminPage /></RequireAuth>
          } />
          <Route path="/activity" element={
            <RequireAuth><ActivityPage /></RequireAuth>
          } />
          <Route path="/settings" element={
            <RequireAuth><SettingsPage /></RequireAuth>
          } />
          <Route path="/errors" element={
            <RequireAuth><ErrorsPage /></RequireAuth>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
