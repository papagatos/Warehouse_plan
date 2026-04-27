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
      <ProductsManager />
    </div>
  )
}

export function ProductsManager() {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [newBarcode, setNewBarcode] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.get(`/products${q ? `?search=${q}` : ''}`)
      setProducts(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(window._pt)
    window._pt = setTimeout(() => load(val), 400)
  }

  const handleAdd = async () => {
    if (!newBarcode.trim() || !newName.trim()) { setError('Заполни штрихкод и название'); return }
    setAdding(true); setError(null)
    try {
      const res = await api.post('/products', { barcode: newBarcode.trim(), name: newName.trim() })
      setProducts(p => [res.data, ...p])
      setNewBarcode(''); setNewName('')
    } catch (e) {
      setError(e.response?.data?.message || 'Ошибка добавления')
    } finally { setAdding(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить товар?')) return
    await api.delete(`/products/${id}`)
    setProducts(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="card divide-y divide-gray-100">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">Товары ({products.length})</h2>
      </div>

      {/* Добавить товар */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-gray-500">Добавить товар</p>
        <input className="input text-sm" placeholder="Штрихкод"
          value={newBarcode} onChange={e => setNewBarcode(e.target.value)} />
        <input className="input text-sm" placeholder="Наименование"
          value={newName} onChange={e => setNewName(e.target.value)} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={handleAdd} disabled={adding}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
          {adding ? 'Добавляем...' : '+ Добавить'}
        </button>
      </div>

      {/* Поиск */}
      <div className="px-4 py-3">
        <input className="input text-sm" placeholder="Поиск по названию или штрихкоду"
          value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      {/* Список */}
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {loading && <p className="px-4 py-3 text-xs text-gray-400">Загрузка...</p>}
        {!loading && products.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Ничего не найдено</p>}
        {products.map(p => (
          <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-800 truncate">{p.name}</p>
              <p className="text-xs text-gray-400">{p.barcode}</p>
            </div>
            <button onClick={() => handleDelete(p.id)}
              className="text-xs text-red-400 hover:text-red-600 shrink-0">
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
