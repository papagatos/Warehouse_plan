import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'

export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg]           = useState(null)
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const r = await api.post('/auth/forgot-password', { email })
      setMsg(r.data.message)
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await api.post('/auth/reset-password', { token, password })
      setMsg('Пароль изменён! Перейдите на страницу входа.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">
          {token ? 'Новый пароль' : 'Сброс пароля'}
        </h1>

        {msg ? (
          <p className="text-green-600 text-sm text-center">{msg}</p>
        ) : token ? (
          <form onSubmit={handleReset} className="space-y-3">
            <input
              type="password"
              className="input"
              placeholder="Новый пароль (мин. 6 символов)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={6}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Сохраняем...' : 'Сохранить пароль'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-3">
            <p className="text-sm text-gray-500 text-center">
              Введите email — пришлём ссылку для сброса пароля
            </p>
            <input
              type="email"
              className="input"
              placeholder="admin@warehouse.local"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Отправляем...' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        <button onClick={() => navigate('/login')} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">
          Вернуться на вход
        </button>
      </div>
    </div>
  )
}
