import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Camera, Clock, Truck, Package, Trash2 } from 'lucide-react'
import { StatusBadge, RowTypeBadge, STATUS_CONFIG, ALLOWED_STATUS_TRANSITIONS } from './StatusBadge.jsx'
import PhotoUpload from './PhotoUpload.jsx'
import { plansApi } from '../api/index.js'
import { useRole, useAuth } from '../api/auth.jsx'
import api from '../api/client.js'

const STATUS_BG = {
  WAITING:     'border-l-4 border-l-[#f5c842] bg-[#FFEFC1]/30',
  IN_PROGRESS: 'border-l-4 border-l-[#e8848a] bg-[#F0BFC1]/30',
  POSTPONED:   'border-l-4 border-l-[#6b9de8] bg-[#BED0F6]/30',
  ASSEMBLED:   'border-l-4 border-l-[#f5c842] bg-[#FFEFC1]/30',
  ACCEPTED:    'border-l-4 border-l-[#5aab6b] bg-[#D0E7C9]/30',
  SHIPPED:     'border-l-4 border-l-[#5aab6b] bg-[#D0E7C9]/30',
}




function PalletsExtraField({ row, onUpdate, compact = false }) {
  const [val, setVal] = React.useState(row.palletsExtra || '')
  const [saved, setSaved] = React.useState(false)

  const calcSum = (v) => {
    try {
      const n = v.split('+').map(Number).filter(Boolean).reduce((a,b)=>a+b,0)
      return n > 0 ? n : null
    } catch { return null }
  }

  const handleSave = async () => {
    try {
      await api.patch(`/rows/${row.id}`, { palletsExtra: val.trim() || null })
      onUpdate({ ...row, palletsExtra: val.trim() || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
  }

  const sum = calcSum(val)
  const changed = val !== (row.palletsExtra || '')

  if (compact) return (
    <div>
      <p className="text-xs text-gray-500 mb-1">🔲 Добавка</p>
      <div className="flex items-center gap-1.5">
        <input
          className="input font-mono text-sm"
          placeholder="2+1"
          value={val}
          onChange={e => { setVal(e.target.value); setSaved(false) }}
          onBlur={async () => { if (changed) await handleSave() }}
          maxLength={30}
        />
        {sum ? <span className="text-xs font-bold text-gray-700 whitespace-nowrap shrink-0">{sum}</span> : null}
      </div>
    </div>
  )

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">🔲 Добавка (поддоны)</p>
      <div className="flex items-center gap-2">
        <input
          className="input font-mono"
          style={{width: '60%'}}
          placeholder="напр. 2+1"
          value={val}
          onChange={e => { setVal(e.target.value); setSaved(false) }}
        />
        {sum && <span className="text-sm font-bold text-gray-700 whitespace-nowrap shrink-0">= {sum} шт</span>}
        {changed && (
          <button onClick={handleSave} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">
            Сохранить
          </button>
        )}
        {saved && <span className="text-xs text-green-600">✓</span>}
      </div>
    </div>
  )
}

function LabelButton({ row }) {
  const [subtype, setSubtype] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)
  const [printMain, setPrintMain] = React.useState(true)
  const [printExtra, setPrintExtra] = React.useState(!!row.palletsExtra)
  const [faxSending, setFaxSending] = React.useState(false)
  const [faxSent,    setFaxSent]    = React.useState(false)
  const [faxError,   setFaxError]   = React.useState(null)

  const hasMain  = !!row.pallets
  const hasExtra = !!row.palletsExtra

  const sendToFax = async () => {
    setFaxSending(true)
    setFaxError(null)
    setFaxSent(false)
    try {
      await api.post('/settings/send-fax', {
        rowId: row.id,
        subtype,
        main:  printMain  ? '1' : '0',
        extra: printExtra ? '1' : '0',
      })
      setFaxSent(true)
      setTimeout(() => setFaxSent(false), 3000)
    } catch (e) {
      setFaxError(e.response?.data?.error || 'Ошибка отправки')
    } finally {
      setFaxSending(false)
    }
  }

  const openPreview = () => {
    const token = localStorage.getItem('token') || ''
    const params = new URLSearchParams()
    if (subtype) params.set('subtype', subtype)
    params.set('token', token)
    params.set('main',  printMain  ? '1' : '0')
    params.set('extra', printExtra ? '1' : '0')
    window.open(`/api/labels/${row.id}?${params.toString()}`, '_blank')
    setShowForm(false)
    setSubtype('')
  }

  return (
    <div className="pt-2 border-t border-gray-100">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          🏷️ Печать этикеток
        </button>
      ) : (
        <div className="space-y-3 bg-purple-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-800">Настройки печати</p>

          {/* Что печатать */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">Что печатать:</p>
            {hasMain && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={printMain}
                  onChange={e => setPrintMain(e.target.checked)}
                  className="w-4 h-4" />
                <span>📋 Основные ({row.pallets})</span>
              </label>
            )}
            {hasExtra && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={printExtra}
                  onChange={e => setPrintExtra(e.target.checked)}
                  className="w-4 h-4" />
                <span>⚠️ Добавка ({row.palletsExtra})</span>
              </label>
            )}
          </div>

          {/* Подтип */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Точка выгрузки (необязательно)</p>
            <input
              className="input text-sm"
              placeholder="напр. Магазин №1 / Магазин №2"
              value={subtype}
              onChange={e => setSubtype(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Для нескольких групп — разделяй через /</p>
          </div>

          {faxError && <p className="text-xs text-red-500">{faxError}</p>}
          {faxSent  && <p className="text-xs text-green-600">✓ Отправлено на факс!</p>}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openPreview}
              disabled={!printMain && !printExtra}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              🏷️ Превью
            </button>
            <button
              onClick={sendToFax}
              disabled={(!printMain && !printExtra) || faxSending}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {faxSending ? '📤 Отправка...' : '📠 На факс'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs px-3 py-1.5">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function ParticipantsBlock({ rowId }) {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    plansApi.getHistory(rowId).then(history => {
      // Кто перевёл в IN_PROGRESS — кладовщик
      const warehouse = history.find(h => h.newStatus === 'IN_PROGRESS')
      // Кто перевёл в SHIPPED — грузчик
      const loader = history.find(h => h.newStatus === 'SHIPPED')
      // Кто перевёл в ACCEPTED — приёмщик
      const receiver = history.find(h => h.newStatus === 'ACCEPTED')
      setData({ warehouse, loader, receiver })
    }).catch(() => {})
  }, [rowId])

  if (!data) return null
  if (!data.warehouse && !data.loader && !data.receiver) return null

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
      <p className="text-xs font-medium text-gray-500">Участники</p>
      {data.warehouse && (
        <p className="text-xs text-gray-600">
          🏭 Кладовщик: <span className="font-medium">{data.warehouse.changedBy?.name}</span>
        </p>
      )}
      {data.loader && (
        <p className="text-xs text-gray-600">
          🚛 Грузчик: <span className="font-medium">{data.loader.changedBy?.name}</span>
        </p>
      )}
      {data.receiver && (
        <p className="text-xs text-gray-600">
          📦 Приёмщик: <span className="font-medium">{data.receiver.changedBy?.name}</span>
        </p>
      )}
    </div>
  )
}

function PhoneField({ phone, setPhone, phoneChanged, setPhoneChanged, onSave, canEdit }) {
  const [editing, setEditing] = React.useState(false)

  const startEdit = () => {
    if (!phone) setPhone('+7')
    setEditing(true)
  }

  const handleChange = (e) => {
    let v = e.target.value
    if (v.startsWith('8')) v = '+7' + v.slice(1)
    if (v.length > 0 && v !== '+' && !v.startsWith('+')) v = '+7' + v
    setPhone(v)
    setPhoneChanged(true)
  }

  const handleSave = async () => {
    if (phone === '+7') setPhone('')
    await onSave()
    setEditing(false)
    setPhoneChanged(false)
  }

  const handleCancel = () => {
    setEditing(false)
    setPhoneChanged(false)
  }

  // Режим просмотра — есть номер
  if (phone && !editing) {
    return (
      <div className="flex items-center justify-between">
        <a href={`tel:${phone.replace(/\s/g,'')}`}
          className="flex items-center gap-1.5 text-blue-600 font-medium hover:underline text-sm">
          📞 {phone}
        </a>
        {canEdit && (
          <button onClick={startEdit} className="text-xs text-gray-400 hover:text-gray-600">
            Изменить
          </button>
        )}
      </div>
    )
  }

  // Режим редактирования или нет номера
  if (editing || !phone) {
    return (
      <div className="space-y-2">
        {!editing && canEdit && (
          <button onClick={startEdit}
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
            📞 Добавить телефон
          </button>
        )}
        {editing && (
          <>
            <input
              className="input"
              placeholder="+7 999 000 00 00"
              type="tel"
              value={phone}
              autoFocus
              onBlur={() => { if (phone === '+7') { setPhone(''); setEditing(false) } }}
              onChange={handleChange}
            />
            <div className="flex gap-2">
              <button onClick={handleSave}
                className="btn-primary text-xs px-3 py-1.5">
                Сохранить
              </button>
              <button onClick={handleCancel}
                className="btn-secondary text-xs px-3 py-1.5">
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}

export default function PlanRow({ row, onUpdate, onDelete }) {
  const [expanded, setExpanded]   = useState(false)
  const [changing, setChanging]   = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState(null)
  const { role, canEdit, isSuper } = useRole()
  const [pallets, setPallets] = useState(row.pallets || '')
  const [phone, setPhone] = useState(row.phone || '')
  const [phoneChanged, setPhoneChanged] = useState(false)
  const [postponedDate, setPostponedDate] = useState(row.postponedDate ? row.postponedDate.slice(0,10) : '')
  const [pendingStatus, setPendingStatus] = useState(null)
  const [palletsChanged, setPalletsChanged] = useState(false)
  const { user } = useAuth()

  const allowed = ALLOWED_STATUS_TRANSITIONS[role]?.[row.rowType] || []
  const canChangeStatus = canEdit && allowed.length > 0
  const canDelete = isSuper || (role === 'MANAGER' && row.createdById === user?.id)

  const calcPallets = (val) => {
    try {
      const nums = val.split('+').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
    } catch { return null }
  }

  const handlePhoneSave = async () => {
    try {
      await api.patch(`/rows/${row.id}`, { phone: phone.trim() || null })
      setPhoneChanged(false)
      onUpdate({ ...row, phone: phone.trim() || null })
    } catch (e) { setError('Ошибка сохранения телефона') }
  }

  const handlePalletsSave = async () => {
    try {
      const updated = await plansApi.updateStatus(row.id, row.status, '', pallets)
      setPalletsChanged(false)
      onUpdate({ ...row, pallets, ...(updated || {}) })
    } catch (e) {
      setError('Ошибка сохранения поддонов')
    }
  }

  const handleStatusChange = async (newStatus, date = null) => {
    if (newStatus === row.status && !date) return
    if (newStatus === 'POSTPONED' && !date) {
      setPendingStatus('POSTPONED')
      return
    }
    setChanging(true)
    setError(null)
    try {
      const updated = await plansApi.updateStatus(row.id, newStatus, '', pallets, date)
      onUpdate(updated)
      setPendingStatus(null)
      setPostponedDate(date || '')
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка смены статуса')
    } finally {
      setChanging(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить запись "${row.counterparty}"?`)) return
    setDeleting(true)
    try {
      await api.delete(`/rows/${row.id}`)
      onDelete(row.id)
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка удаления')
      setDeleting(false)
    }
  }

  const photoCount = row._count?.photos || row.photos?.length || 0

  return (
    <div className={`border rounded-xl overflow-hidden ${row.isPostponed ? 'border-blue-200 bg-[#BED0F6]/20 border-l-4 border-l-blue-400' : 'border-gray-200 ' + (STATUS_BG[row.status] || 'bg-white')}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <RowTypeBadge type={row.rowType} rawType={row.rawType} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base leading-tight">
            {row.counterparty || <span className="text-gray-400 italic">Контрагент не указан</span>}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-xs text-gray-500">
            {row.manager && <span>👤 {row.manager}</span>}
            {row.vehicleNumber && <span><Truck className="inline w-3 h-3 mr-0.5" />{row.vehicleNumber}</span>}
            {row.weight && <span><Package className="inline w-3 h-3 mr-0.5" />{row.weight} т</span>}
            {(row.pallets || row.palletsExtra) && (() => {
              const s = (v) => { try { return v ? v.split('+').map(Number).filter(Boolean).reduce((a,b)=>a+b,0) : 0 } catch { return 0 } }
              const total = s(row.pallets) + s(row.palletsExtra)
              return total > 0 ? <span className="font-bold text-gray-700 whitespace-nowrap">🔲 {total} шт</span> : null
            })()}
            {photoCount > 0 && <span className="text-blue-500"><Camera className="inline w-3 h-3 mr-0.5" />{photoCount}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {row.isPostponed && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium border border-blue-200">
              ↷ Перенос
            </span>
          )}
          <StatusBadge status={row.status} />
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Участники — для супера */}
          {isSuper && (
            <ParticipantsBlock rowId={row.id} />
          )}

          {row.isPostponed && row.originalDate && (
            <p className="text-xs text-blue-500 bg-blue-50 rounded-lg px-3 py-1.5">
              ↷ Перенесено с {new Date(row.originalDate).toLocaleDateString('ru', {day:'2-digit', month:'long'})}
            </p>
          )}
          {row.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{row.notes}</p>
          )}

          {/* Телефон */}
          <PhoneField
            phone={phone}
            setPhone={setPhone}
            phoneChanged={phoneChanged}
            setPhoneChanged={setPhoneChanged}
            onSave={handlePhoneSave}
            canEdit={canEdit}
          />

          {/* Поддоны добавка */}
          {/* Поддоны + Добавка — в одну строку */}
          {(role === 'WAREHOUSE' || isSuper) && row.rowType !== 'ARRIVAL' && row.rowType !== 'RETURN' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                {/* Основные */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Поддоны</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      className="input font-mono text-sm"
                      placeholder="3+4+1"
                      value={pallets}
                      onChange={e => { setPallets(e.target.value); setPalletsChanged(true) }}
                      maxLength={30}
                    />
                    {pallets && <span className="text-xs font-bold text-gray-700 whitespace-nowrap shrink-0">{calcPallets(pallets) ?? '?'}</span>}
                  </div>
                </div>
                {/* Добавка */}
                <PalletsExtraField key={row.palletsExtra || 'empty'} row={row} onUpdate={onUpdate} compact />
              </div>
              {palletsChanged && (
                <button onClick={handlePalletsSave} className="btn-primary text-xs px-3 py-1.5 w-full justify-center">
                  Сохранить поддоны
                </button>
              )}
              {row.pallets && !palletsChanged && (
                <p className="text-xs text-gray-400">
                  Сохранено: осн {calcPallets(row.pallets) ?? 0}
                  {row.palletsExtra ? ` + доб ${calcPallets(row.palletsExtra) ?? 0}` : ''}
                  {' '}= {(calcPallets(row.pallets) ?? 0) + (calcPallets(row.palletsExtra) ?? 0)} шт
                </p>
              )}
            </div>
          )}

          {canChangeStatus && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Сменить статус</p>
              <div className="flex flex-wrap gap-2">
                {allowed.map(status => {
                  const cfg = STATUS_CONFIG[status]
                  const isCurrent = status === row.status
                  return (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={changing || isCurrent}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
                        isCurrent
                          ? 'opacity-100 ring-2 ring-offset-1 ring-blue-400 ' + cfg.color
                          : cfg.color + ' hover:opacity-80 border-transparent'
                      } disabled:cursor-not-allowed`}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <PhotoUpload row={row} onUpdate={onUpdate} />
          <HistoryButton rowId={row.id} />

          {/* Кнопка этикеток */}
          {(role === 'WAREHOUSE' || isSuper) && row.rowType !== 'ARRIVAL' && row.rowType !== 'RETURN' && (
            <LabelButton row={row} />
          )}

          {canDelete && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Удаляем...' : 'Удалить запись'}
              </button>
            </div>
          )}

          {/* Датапикер для переноса */}
          {pendingStatus === 'POSTPONED' && (
            <div className="bg-blue-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-blue-700">На какую дату переносим?</p>
              <input
                type="date"
                className="input"
                value={postponedDate}
                min={new Date().toISOString().slice(0,10)}
                onChange={e => setPostponedDate(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange('POSTPONED', postponedDate || null)}
                  disabled={!postponedDate}
                  className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  Подтвердить перенос
                </button>
                <button onClick={() => setPendingStatus(null)} className="btn-secondary text-xs px-3 py-1.5">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Показываем дату переноса если установлена */}
          {row.postponedDate && row.status === 'POSTPONED' && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
              Перенесено на: {new Date(row.postponedDate).toLocaleDateString('ru', {day:'2-digit', month:'2-digit', year:'numeric'})}
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

function HistoryButton({ rowId }) {
  const [history, setHistory] = useState(null)
  const [open, setOpen] = useState(false)

  const load = async () => {
    if (history) { setOpen(o => !o); return }
    const data = await plansApi.getHistory(rowId)
    setHistory(data)
    setOpen(true)
  }

  return (
    <div>
      <button onClick={load} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
        <Clock className="w-3 h-3" /> История изменений
      </button>
      {open && history && (
        <div className="mt-2 space-y-1">
          {history.length === 0
            ? <p className="text-xs text-gray-400">Нет изменений</p>
            : history.map(h => (
              <div key={h.id} className="text-xs text-gray-500 flex gap-2">
                <span className="text-gray-300">
                  {new Date(h.changedAt).toLocaleString('ru', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </span>
                <span>{h.changedBy?.name || '—'}</span>
                <span>{STATUS_CONFIG[h.oldStatus]?.label} → {STATUS_CONFIG[h.newStatus]?.label}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}
