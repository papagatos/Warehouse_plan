import React, { useState } from 'react'
import { Plus, X, Calendar } from 'lucide-react'
import { useRole } from '../api/auth.jsx'
import api from '../api/client.js'

const ROW_TYPES = [
  { value: 'ARRIVAL',    rowType: 'ARRIVAL',    rawType: 'П',  label: 'Поступление', short: 'П',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'DELIVERY',   rowType: 'DELIVERY',   rawType: 'Д',  label: 'Доставка',    short: 'Д',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'PICKUP',     rowType: 'PICKUP',     rawType: 'С',  label: 'Самовывоз',   short: 'С',  color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'CONTAINER1', rowType: 'CONTAINER',  rawType: 'К1', label: 'Контейнер',   short: 'К1', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'CONTAINER2', rowType: 'CONTAINER',  rawType: 'К2', label: 'Контейнер',   short: 'К2', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'RETURN',     rowType: 'RETURN',     rawType: 'В',  label: 'Возврат',     short: 'В',  color: 'bg-red-100 text-red-700 border-red-200' },
]

export default function CreateRowForm({ planDate, onCreated }) {
  const { role } = useRole()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    rowType: 'DELIVERY', counterparty: '', weight: '', manager: '',
    phone: '', vehicleNumber: '', notes: '', date: planDate,
  })

  if (role !== 'SUPER' && role !== 'MANAGER') return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.counterparty.trim()) { setError('Укажи контрагента'); return }
    setLoading(true); setError(null)
    try {
      const selected = ROW_TYPES.find(t => t.value === form.rowType)
      const res = await api.post('/rows', {
        planDate: form.date,
        rowType: selected.rowType,
        rawType: selected.rawType,
        counterparty: form.counterparty.trim(),
        weight: form.weight ? parseFloat(form.weight) : null,
        manager: form.manager.trim() || null,
        phone:         form.phone.trim() || null,
        vehicleNumber: form.vehicleNumber.trim() || null,
        notes: form.notes.trim() || null,
      })
      onCreated(res.data, form.date)
      setForm({ rowType: 'DELIVERY', counterparty: '', weight: '', manager: '', vehicleNumber: '', notes: '', date: planDate })
      setOpen(false)
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка создания')
    } finally { setLoading(false) }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Новая отгрузка
        </button>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Новая отгрузка</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Дата</label>
                <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Тип отгрузки</label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {ROW_TYPES.map(t => (
                    <button key={t.value} onClick={() => set('rowType', t.value)}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                        form.rowType === t.value ? t.color + ' border-current shadow-sm scale-105' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                      }`}>
                      <div className="text-base mb-0.5">{t.short}</div>
                      <div className="leading-tight">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Контрагент *</label>
                <input className="input" placeholder="Название компании или ФИО" autoFocus
                  value={form.counterparty} onChange={e => set('counterparty', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Вес (т)</label>
                  <input className="input" type="number" step="0.1" min="0" placeholder="0.0"
                    value={form.weight} onChange={e => set('weight', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">№ Машины</label>
                  <input className="input" placeholder="А000АА 000"
                    value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">📞 Телефон</label>
                <input className="input" placeholder="+7 999 000 00 00" type="tel"
                  value={form.phone}
                  onFocus={() => { if (!form.phone) set('phone', '+7') }}
                  onBlur={() => { if (form.phone === '+7') set('phone', '') }}
                  onChange={e => {
                    let v = e.target.value
                    if (v.startsWith('8')) v = '+7' + v.slice(1)
                    if (v.length > 0 && v !== '+' && !v.startsWith('+')) v = '+7' + v
                    set('phone', v)
                  }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Комментарий</label>
                <textarea className="input resize-none" rows={2} placeholder="Дополнительная информация..."
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'Сохраняем...' : 'Создать запись'}
              </button>
              <button onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
