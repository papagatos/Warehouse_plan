import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/index.js'
import { ROLE_LABELS } from '../components/StatusBadge.jsx'
import { useAuth } from '../api/auth.jsx'

export default function RegisterPage() {
  const [params]    = useSearchParams()
  const token       = params.get('token')
  const navigate    = useNavigate()
  const { login }   = useAuth()

  const [invite, setInvite] = useState(null)
  const [inviteError, setInviteError] = useState(null)
  const [form, setForm]     = useState({ name: '', email: '', password: '', phone: '' })
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  // Проверяем инвайт при загрузке
  useEffect(() => {
    if (!token) { setInviteError('Ссылка недействительна'); return }
    authApi.checkInvite(token)
      .then(setInvite)
      .catch(() => setInviteError('Инвайт-ссылка недействительна или истекла'))
  }, [token])

  const formatPhone = (v) => {
    if (v.startsWith('8')) v = '+7' + v.slice(1)
    if (v.length > 0 && v !== '+' && !v.startsWith('+')) v = '+7' + v
    return v
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await authApi.register(token, form)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-gray-700">{inviteError}</p>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Проверяем ссылку...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-xl font-semibold">Регистрация</h1>
          <p className="text-sm text-gray-500 mt-1">
            Роль: <span className="font-medium text-gray-700">{ROLE_LABELS[invite.role]}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
              <input type="text" className="input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📞 Телефон (для этикеток)</label>
              <input type="tel" className="input" value={form.phone}
                placeholder="+7 999 000 00 00"
                onFocus={() => { if (!form.phone) setForm(f => ({ ...f, phone: '+7' })) }}
                onBlur={() => { if (form.phone === '+7') setForm(f => ({ ...f, phone: '' })) }}
                onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input type="password" className="input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  )
}
