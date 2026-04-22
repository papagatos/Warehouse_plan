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

  const grouped = Object.entries(
    rows.reduce((acc, row) => { acc[row.rowType] = acc[row.rowType] || []; acc[row.rowType].push(row); return acc }, {})
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

        <div className="ml-auto relative">
          <button
            className="btn-secondary"
            title="Выбрать дату"
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
          >
            <CalendarDays className="w-4 h-4" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={e => navigate(`/plan/${e.target.value}`)}
            className="absolute opacity-0 w-0 h-0 top-0 left-0 pointer-events-none"
          />
        </div>
      </div>





      {loading ? (
        <div className="text-center py-16 text-gray-400">Загрузка...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-500">На эту дату записей нет</p>
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
