import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../api/auth.jsx'
import api from '../api/client.js'

async function downloadFile(url, filename) {
  const token = localStorage.getItem('token') || ''
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
  if (!res.ok) { alert('Ошибка скачивания'); return }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ErrorsPage() {
  const { isSuper } = useRole()
  const navigate = useNavigate()
  const [tab, setTab] = useState('frontend')
  const [frontErrors, setFrontErrors] = useState([])
  const [backLines, setBackLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!isSuper) { navigate('/'); return }
    Promise.all([
      api.get('/errors').then(r => setFrontErrors(r.data.errors || [])),
      api.get('/errors/backend').then(r => setBackLines(r.data.lines || [])),
    ]).finally(() => setLoading(false))
  }, [isSuper])

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-400">Загрузка...</div>

  const today = new Date().toISOString().slice(0,10)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Ошибки</h1>
        <button
          onClick={() => downloadFile(
            tab === 'frontend' ? '/api/errors/download' : '/api/errors/backend/download',
            tab === 'frontend' ? `frontend-errors-${today}.log` : `backend-err-${today}.log`
          )}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-medium transition-colors"
        >
          ⬇ Скачать полный лог
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => { setTab('frontend'); setExpanded(null) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'frontend' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Фронтенд {frontErrors.length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{frontErrors.length}</span>}
        </button>
        <button
          onClick={() => { setTab('backend'); setExpanded(null) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'backend' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Бэкенд {backLines.length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{backLines.length}</span>}
        </button>
      </div>

      {/* Фронтенд */}
      {tab === 'frontend' && (
        frontErrors.length === 0
          ? <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">✅</p><p>Ошибок нет</p></div>
          : <div className="space-y-2">
              {frontErrors.map((err, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === i ? null : i)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-red-600 truncate">{err.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {err.time} · <span className="font-medium text-gray-500">{err.role}</span> · {err.url}
                        </p>
                      </div>
                      <span className="text-gray-300 text-xs shrink-0">{expanded === i ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === i && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                      {err.stack && <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{err.stack}</pre>}
                      {err.ua && <p className="text-xs text-gray-400">UA: {err.ua}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
      )}

      {/* Бэкенд */}
      {tab === 'backend' && (
        backLines.length === 0
          ? <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">✅</p><p>Ошибок нет</p></div>
          : <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 whitespace-pre-wrap break-all space-y-1">
                {backLines.map((line, i) => (
                  <div key={i} className={line.includes('ERROR') ? 'text-red-400' : 'text-green-400'}>
                    {line}
                  </div>
                ))}
              </pre>
            </div>
      )}
    </div>
  )
}
