import React, { useState, useEffect } from 'react'
import { Copy, Check, UserPlus, Shield } from 'lucide-react'
import { adminApi, authApi } from '../api/index.js'
import api from '../api/client.js'
import { ROLE_LABELS } from '../components/StatusBadge.jsx'
import { useRole } from '../api/auth.jsx'
import { useNavigate } from 'react-router-dom'

const ROLES = ['SUPER', 'MANAGER', 'WAREHOUSE', 'LOADER', 'RECEIVER', 'VIEWER']
const ROLE_COLORS = {
  SUPER:     'bg-purple-100 text-purple-700',
  WAREHOUSE: 'bg-blue-100 text-blue-700',
  LOADER:    'bg-orange-100 text-orange-700',
  RECEIVER:  'bg-green-100 text-green-700',
  VIEWER:    'bg-gray-100 text-gray-600',
}

function InviteLog({ invites }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="card divide-y divide-gray-100">
      <button className="px-4 py-3 w-full flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <h2 className="text-sm font-semibold text-gray-700">История приглашений ({invites.length})</h2>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && invites.map(inv => (
        <div key={inv.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {inv.usedBy?.email || inv.email || <span className="text-gray-400 italic">не использован</span>}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(inv.createdAt).toLocaleString('ru', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
              {inv.createdBy?.name ? ` · ${inv.createdBy.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              inv.usedAt ? 'bg-green-100 text-green-700' :
              new Date(inv.expiresAt) < new Date() ? 'bg-gray-100 text-gray-400' :
              'bg-blue-100 text-blue-700'
            }`}>
              {inv.usedAt ? '✓ Использован' :
               new Date(inv.expiresAt) < new Date() ? 'Истёк' : ROLE_LABELS[inv.role]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const { isSuper } = useRole()
  const navigate    = useNavigate()
  const [users, setUsers]   = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [newInvite, setNewInvite]   = useState(null)
  const [inviteRole, setInviteRole] = useState('WAREHOUSE')
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(null)

  useEffect(() => {
    if (!isSuper) { navigate('/'); return }
    adminApi.getUsers().then(setUsers).finally(() => setLoading(false))
    authApi.getInvites().then(setInvites).catch(() => {})
  }, [isSuper])

  const handleResetPassword = async (userId, userName) => {
    const pwd = prompt(`Новый пароль для ${userName} (минимум 6 символов):`)
    if (!pwd) return
    if (pwd.length < 6) { alert('Минимум 6 символов'); return }
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { password: pwd })
      alert('Пароль изменён')
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка')
    }
  }

  const handleDeactivate = async (userId, isActive) => {
    const action = isActive ? 'деактивировать' : 'активировать'
    if (!confirm(`${action} пользователя?`)) return
    try {
      await api.patch(`/admin/users/${userId}/deactivate`, { isActive: !isActive })
      setUsers(us => us.map(u => u.id === userId ? { ...u, isActive: !isActive } : u))
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка')
    }
  }

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) { alert('Введите email'); return }
    setSendingInvite(true); setInviteSent(null)
    try {
      const r = await api.post('/auth/send-invite', { email: inviteEmail.trim(), role: inviteRole })
      setInviteSent(r.data.message)
      setInviteEmail('')
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка отправки')
    } finally { setSendingInvite(false) }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      const updated = await adminApi.updateRole(userId, role)
      setUsers(us => us.map(u => u.id === updated.id ? { ...u, role: updated.role } : u))
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка')
    }
  }

  const createInvite = async () => {
    try {
      const inv = await authApi.createInvite(inviteRole, 7)
      setNewInvite(inv)
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка создания инвайта')
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(newInvite.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Shield className="w-5 h-5 text-purple-600" />
        Управление пользователями
      </h1>

      {/* ── Создать инвайт ── */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" /> Пригласить пользователя
        </h2>
        <div className="flex gap-2">
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="input flex-1"
          >
            {ROLES.filter(r => r !== 'SUPER' && r !== 'VIEWER').map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button onClick={createInvite} className="btn-primary whitespace-nowrap">
            Создать ссылку
          </button>
        </div>

        {/* Email инвайт */}
        <div className="flex gap-2 mt-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="email сотрудника"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
          />
          <button onClick={handleSendInvite} disabled={sendingInvite}
            className="btn-primary whitespace-nowrap">
            {sendingInvite ? '...' : '📨 Отправить'}
          </button>
        </div>
        {inviteSent && <p className="text-xs text-green-600 mt-1">✓ {inviteSent}</p>}

        {newInvite && (
          <div className="mt-3 bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-700 mb-1.5 font-medium">
              Ссылка для роли «{ROLE_LABELS[newInvite.role]}» (действует 7 дней):
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border border-green-200 rounded px-2 py-1 flex-1 truncate text-gray-700">
                {newInvite.link}
              </code>
              <button onClick={copyLink} className="btn-secondary p-1.5">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Список пользователей ── */}
      <div className="card divide-y divide-gray-100">
        {users.map(user => (
          <div key={user.id} className={`flex items-center gap-3 p-4 ${!user.isActive ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{user.name}</p>
                {!user.isActive && <span className="text-xs text-red-500">заблокирован</span>}
              </div>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              {user.lastLoginAt && (
                <p className="text-xs text-gray-400">
                  Вход: {new Date(user.lastLoginAt).toLocaleString('ru', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={user.role}
                onChange={e => handleRoleChange(user.id, e.target.value)}
                className={`text-xs font-medium rounded-lg px-2 py-1 border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button
                onClick={() => handleResetPassword(user.id, user.name)}
                className="text-xs px-2 py-1 rounded-lg text-blue-500 hover:bg-blue-50"
                title="Сменить пароль"
              >
                🔑
              </button>
              <button
                onClick={() => handleDeactivate(user.id, user.isActive)}
                className={`text-xs px-2 py-1 rounded-lg ${user.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
              >
                {user.isActive ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        ))}
      </div>

    {/* Лог приглашений */}
    {invites.length > 0 && (
      <InviteLog invites={invites} />
    )}
  </div>
  )
}
