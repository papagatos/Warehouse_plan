import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { useRole } from '../api/auth.jsx'
import { useNavigate } from 'react-router-dom'
import { STATUS_CONFIG, ROW_TYPE_CONFIG } from '../components/StatusBadge.jsx'

export default function ActivityPage() {
  const { isSuper } = useRole()
  const navigate = useNavigate()
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSuper) { navigate('/'); return }
    api.get('/admin/activity').then(r => setLog(r.data)).finally(() => setLoading(false))
  }, [isSuper])

  if (loading) return <div className="text-center py-16 text-gray-400">Загрузка...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">📋 Журнал действий</h1>

      <div className="card divide-y divide-gray-100">
        {log.length === 0 && (
          <p className="text-center py-8 text-gray-400">Действий пока нет</p>
        )}
        {log.map(entry => (
          <div key={entry.id} className="p-3 flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{entry.changedBy?.name || 'Система'}</span>
                <span className="text-xs text-gray-400">
                  {new Date(entry.changedAt).toLocaleString('ru', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                  {entry.planRow?.counterparty || '—'}
                </span>
                <span className="text-xs text-gray-300">·</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_CONFIG[entry.oldStatus]?.color}`}>
                  {STATUS_CONFIG[entry.oldStatus]?.label}
                </span>
                <span className="text-xs text-gray-400">→</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_CONFIG[entry.newStatus]?.color}`}>
                  {STATUS_CONFIG[entry.newStatus]?.label}
                </span>
              </div>
              {entry.comment && (
                <p className="text-xs text-gray-400 mt-0.5 italic">{entry.comment}</p>
              )}
            </div>
            <div className="text-xs text-gray-400 shrink-0">
              {ROW_TYPE_CONFIG[entry.planRow?.rowType]?.short || '?'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
