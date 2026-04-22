import React, { useState, useEffect } from 'react'
import { useRole } from '../api/auth.jsx'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { Settings, Mail, CheckCircle, XCircle } from 'lucide-react'

export default function SettingsPage() {
  const { isSuper } = useRole()
  const navigate    = useNavigate()
  const [faxEmail, setFaxEmail] = useState('')
  const [saved, setSaved]       = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    if (!isSuper) { navigate('/'); return }
    api.get('/settings').then(r => {
      setFaxEmail(r.data.fax_email || '')
    })
  }, [isSuper])

  const handleSave = async () => {
    await api.patch('/settings', { key: 'fax_email', value: faxEmail })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await api.post('/settings/test-mail')
      setTestResult(r.data)
    } catch (e) {
      setTestResult({ ok: false, error: e.response?.data?.error || 'Ошибка' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-600" />
        Настройки
      </h1>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Mail className="w-4 h-4" /> Email для отправки этикеток (факс)
        </h2>

        <div className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="fax@example.com"
            value={faxEmail}
            onChange={e => { setFaxEmail(e.target.value); setSaved(false) }}
          />
          <button onClick={handleSave} className="btn-primary whitespace-nowrap">
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary text-sm"
          >
            {testing ? 'Проверяем...' : 'Проверить SMTP'}
          </button>
          {testResult && (
            <span className={`flex items-center gap-1.5 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {testResult.ok
                ? <><CheckCircle className="w-4 h-4" /> SMTP работает</>
                : <><XCircle className="w-4 h-4" /> {testResult.error}</>
              }
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
