import React, { useState } from 'react'
import api from '../api/client.js'

export default function ArrivalLabel({ row }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [mfgDate, setMfgDate] = useState('')
  const [searching, setSearching] = useState(false)

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
    })
    const res = await fetch(`/api/labels/arrival/${row.id}?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const html = await res.text()
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
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

          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={!selected}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
              🖨️ Печать
            </button>
            <button onClick={() => { setOpen(false); setSelected(null); setQuery(''); setMfgDate('') }}
              className="btn-secondary text-xs px-3 py-1.5">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
