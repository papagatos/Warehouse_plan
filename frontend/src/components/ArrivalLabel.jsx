import React, { useState } from 'react'
import api from '../api/client.js'

export default function ArrivalLabel({ row }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [mfgDate, setMfgDate] = useState('')
  const [copies, setCopies] = useState(1)
  const [searching, setSearching] = useState(false)
  const [printLog, setPrintLog] = useState([])

  // Загружаем лог при открытии
  const loadLog = async () => {
    try {
      const res = await api.get(`/labels/print-log/${row.id}`)
      setPrintLog(res.data)
    } catch {}
  }

  React.useEffect(() => { loadLog() }, [])
  const [faxSending, setFaxSending] = useState(false)
  const [faxSent, setFaxSent] = useState(false)
  const [faxError, setFaxError] = useState(null)

  if (row.rowType !== 'ARRIVAL') return null

  const handleSearch = async (val) => {
    setQuery(val)
    setSelected(null)
    const digits = val.replace(/\D/g, '')
    if (digits.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await api.get(`/products/search?q=${digits}`)
      setResults(res.data)
    } catch {}
    finally { setSearching(false) }
  }

  const handlePrint = async () => {
    if (!selected) return
    const token = localStorage.getItem('token') || ''
    const params = new URLSearchParams({
      barcode: selected.barcode,
      name: selected.name,
      mfgDate: mfgDate || '',
      copies: copies,
    })
    const res = await fetch(`/api/labels/arrival/${row.id}?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const html = await res.text()
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(loadLog, 1000)
  }

  const handleFax = async () => {
    if (!selected) return
    setFaxSending(true); setFaxError(null); setFaxSent(false)
    try {
      await api.post('/settings/send-fax-arrival', {
        rowId: row.id,
        barcode: selected.barcode,
        name: selected.name,
        mfgDate: mfgDate || '',
        copies,
      })
      setFaxSent(true)
      setTimeout(() => setFaxSent(false), 3000)
      loadLog()
    } catch (e) {
      setFaxError(e.response?.data?.error || 'Ошибка отправки')
    } finally { setFaxSending(false) }
  }

  return (
    <div className="pt-2 border-t border-gray-100">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 font-medium">
          🏷️ Этикетка поступления
        </button>
      ) : (
        <div className="space-y-3 bg-sky-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-sky-800">Этикетка поступления</p>

          {/* Поиск товара */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Поиск по штрихкоду (последние цифры)</p>
            <input
              className="input text-sm"
              placeholder="например: 1234"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Результаты поиска */}
          {searching && <p className="text-xs text-gray-400">Поиск...</p>}
          {!searching && results.length > 0 && !selected && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {results.map(p => (
                <button key={p.id}
                  onClick={() => { setSelected(p); setResults([]) }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-sky-100 border border-gray-200 transition-colors">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.barcode}</p>
                </button>
              ))}
            </div>
          )}
          {!searching && query.replace(/\D/g,'').length >= 2 && results.length === 0 && !selected && (
            <p className="text-xs text-gray-400">Товар не найден</p>
          )}

          {/* Выбранный товар */}
          {selected && (
            <div className="bg-white rounded-lg px-3 py-2 border border-sky-200">
              <p className="text-xs font-semibold text-gray-800 truncate">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.barcode}</p>
              <button onClick={() => { setSelected(null); setQuery('') }}
                className="text-xs text-red-400 hover:text-red-600 mt-1">Изменить</button>
            </div>
          )}

          {/* Дата изготовления */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Дата изготовления</p>
            <input type="date" className="input text-sm"
              value={mfgDate} onChange={e => setMfgDate(e.target.value)} />
          </div>

          {/* Количество копий */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Количество этикеток</p>
            <input type="number" min="1" max="50" className="input text-sm"
              value={copies} onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>

          {faxError && <p className="text-xs text-red-500">{faxError}</p>}
          {faxSent  && <p className="text-xs text-green-600">✓ Отправлено на факс!</p>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={handlePrint} disabled={!selected}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
              🖨️ Печать
            </button>
            <button onClick={handleFax} disabled={!selected || faxSending}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
              {faxSending ? '📤 Отправка...' : '📠 На факс'}
            </button>
            <button onClick={() => { setOpen(false); setSelected(null); setQuery(''); setMfgDate('') }}
              className="btn-secondary text-xs px-3 py-1.5">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Лог печати */}
      {printLog.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1.5">История печати</p>
          <div className="space-y-1">
            {printLog.map((log, i) => (
              <div key={i} className="text-xs text-gray-500 space-y-0.5">
                <div className="flex gap-2">
                  <span className="text-gray-300">
                    {new Date(log.createdAt).toLocaleString('ru', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                  </span>
                  <span className="font-medium">{log.user?.name || '—'}</span>
                  <span>{log.copies} шт · {log.method === 'fax' ? '📠 факс' : '🖨️ печать'}</span>
                </div>
                <div className="text-gray-400 truncate">{log.productName} · {log.barcode}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
