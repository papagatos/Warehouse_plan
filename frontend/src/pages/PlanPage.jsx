import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays } from 'lucide-react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { plansApi } from '../api/index.js'
import { useRole } from '../api/auth.jsx'
import PlanRow from '../components/PlanRow.jsx'
import CreateRowForm from '../components/CreateRowForm.jsx'
import { ROW_TYPE_CONFIG } from '../components/StatusBadge.jsx'

const TODAY = format(new Date(), 'yyyy-MM-dd')

export default function PlanPage() {
  const { date = TODAY } = useParams()
  const navigate = useNavigate()
  const { isSuper, role } = useRole()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [showCal, setShowCal] = useState(false)

  // Фильтры — сохраняются в localStorage
  const [hiddenStatuses, setHiddenStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh_hidden_statuses') || '[]') } catch { return [] }
  })
  const [hiddenTypes, setHiddenTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh_hidden_types') || '[]') } catch { return [] }
  })
  const [showFilters, setShowFilters] = useState(false)

  const toggleStatus = (s) => setHiddenStatuses(prev => {
    const next = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    localStorage.setItem('wh_hidden_statuses', JSON.stringify(next))
    return next
  })
  const toggleType = (t) => setHiddenTypes(prev => {
    const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    localStorage.setItem('wh_hidden_types', JSON.stringify(next))
    return next
  })
  const dateInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await plansApi.getByDate(date)
      setRows(data.rows || [])
    } catch (e) {
      if (e.response?.status === 404) setRows([])
      else setError('Ошибка загрузки плана')
    } finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  const goDate = (delta) => {
    const d = delta === 1
      ? format(addDays(parseISO(date), 1), 'yyyy-MM-dd')
      : format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
    navigate(`/plan/${d}`)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true); setUploadMsg(null)
    try {
      const result = await plansApi.upload(file)
      setUploadMsg(result.message)
      navigate(`/plan/${format(new Date(result.planDate), 'yyyy-MM-dd')}`)
    } catch (e) {
      setUploadMsg('Ошибка: ' + (e.response?.data?.error || e.message))
    } finally { setUploading(false); e.target.value = '' }
  }

  const handleRowUpdate = (updated) => {
    if (updated._needsRefresh) { load(); return }
    setRows(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
  }

  const handleRowCreated = (newRow, createdDate) => {
    if (createdDate === date) setRows(prev => [...prev, newRow])
    else navigate(`/plan/${createdDate}`)
  }

  const handleRowDelete = (deletedId) => setRows(prev => prev.filter(r => r.id !== deletedId))

  const filteredRows = rows.filter(row =>
    !hiddenStatuses.includes(row.status) && !hiddenTypes.includes(row.rowType)
  )
  // Итоги по поддонам за день
  const dayTotals = (() => {
    const s = (v) => { try { return v ? v.split('+').map(Number).filter(Boolean).reduce((a,b)=>a+b,0) : 0 } catch { return 0 } }
    const main  = filteredRows.reduce((acc, r) => acc + s(r.pallets), 0)
    const extra = filteredRows.reduce((acc, r) => acc + s(r.palletsExtra), 0)
    return { main, extra, total: main + extra }
  })()

  const grouped = Object.entries(
    filteredRows.reduce((acc, row) => { acc[row.rowType] = acc[row.rowType] || []; acc[row.rowType].push(row); return acc }, {})
  )

  const dateLabel = format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: ru })
  const canCreate = role === 'SUPER' || role === 'MANAGER'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => goDate(-1)} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <h1 className="text-lg font-semibold capitalize">{dateLabel}</h1>
          {date !== TODAY && (
            <button onClick={() => navigate(`/plan/${TODAY}`)} className="text-xs text-blue-500 hover:underline mt-0.5">Сегодня</button>
          )}
        </div>
        <button onClick={() => goDate(1)} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <CreateRowForm planDate={date} onCreated={handleRowCreated} />

        <label className="btn-secondary ml-auto cursor-pointer relative overflow-hidden" title="Выбрать дату">
          <CalendarDays className="w-4 h-4 pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={e => navigate(`/plan/${e.target.value}`)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            style={{fontSize:'16px'}}
          />
        </label>
      </div>





      {/* Итоги дня */}
      {(dayTotals.total > 0) && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-gray-50 rounded-xl text-sm">
          <span className="text-gray-500">Итого поддонов:</span>
          <span className="font-bold text-gray-800">🔲 {dayTotals.total} шт</span>
          {dayTotals.extra > 0 && (
            <span className="text-xs text-gray-400">
              (осн: {dayTotals.main} + доб: {dayTotals.extra})
            </span>
          )}
        </div>
      )}

      {/* Фильтры */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'WAITING',     label: 'Ожидание',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
            { key: 'IN_PROGRESS', label: 'В работе',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { key: 'ASSEMBLED',   label: 'Собран',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
            { key: 'POSTPONED',   label: 'Перенос',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { key: 'SHIPPED',     label: 'Отгружен',  color: 'bg-green-100 text-green-700 border-green-200' },
            { key: 'ACCEPTED',    label: 'Принят',    color: 'bg-green-100 text-green-700 border-green-200' },
          ].map(({ key, label, color }) => (
            <button key={key} onClick={() => toggleStatus(key)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                hiddenStatuses.includes(key)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-50'
                  : color
              }`}
            >{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ARRIVAL',   label: 'Поступление', color: 'bg-sky-100 text-sky-700 border-sky-200' },
            { key: 'DELIVERY',  label: 'Доставка',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { key: 'PICKUP',    label: 'Самовывоз',   color: 'bg-teal-100 text-teal-700 border-teal-200' },
            { key: 'CONTAINER', label: 'Контейнер',   color: 'bg-violet-100 text-violet-700 border-violet-200' },
            { key: 'RETURN',    label: 'Возврат',     color: 'bg-red-100 text-red-700 border-red-200' },
          ].map(({ key, label, color }) => (
            <button key={key} onClick={() => toggleType(key)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                hiddenTypes.includes(key)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-50'
                  : color
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Загрузка...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-500">
            {filteredRows.length === 0 && rows.length > 0
              ? `Все записи скрыты фильтрами (${rows.length} шт)`
              : 'На эту дату записей нет'
            }
          </p>
          {canCreate && <p className="text-sm text-gray-400 mt-1">Нажми «Новая отгрузка» чтобы добавить</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, typeRows]) => {
            const cfg = ROW_TYPE_CONFIG[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">{cfg?.label || type}</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{typeRows.length}</span>
                </div>
                <div className="space-y-2">
                  {typeRows.map(row => (
                    <PlanRow key={row.id} row={row} onUpdate={handleRowUpdate} onDelete={handleRowDelete} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
