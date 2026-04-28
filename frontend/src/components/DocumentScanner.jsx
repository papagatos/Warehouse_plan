import React, { useState, useRef } from 'react'
import api from '../api/client.js'

const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxSize = 1200
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize }
        else { w = Math.round(w * maxSize / h); h = maxSize }
      }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => resolve({ blob, w, h }), 'image/jpeg', 0.85)
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
})

export default function DocumentScanner({ row, onDocumentAdded, canScan = true, canView = true }) {
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [docs, setDocs] = useState(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const inputRef = useRef()

  const loadDocs = async () => {
    setLoadingDocs(true)
    try {
      const res = await api.get(`/rows/${row.id}/documents`)
      setDocs(res.data)
    } catch {}
    finally { setLoadingDocs(false) }
  }

  React.useEffect(() => { if (canView) loadDocs() }, [canView])

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const { blob, w, h } = await compressImage(file)
    const url = URL.createObjectURL(blob)
    setPages(p => [...p, { blob, w, h, url }])
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!pages.length) return
    setSaving(true); setError(null)
    try {
      const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1')
      const pdfDoc = await PDFDocument.create()
      for (const page of pages) {
        const jpgBytes = await page.blob.arrayBuffer()
        const jpgImage = await pdfDoc.embedJpg(jpgBytes)
        const pdfPage = pdfDoc.addPage([page.w, page.h])
        pdfPage.drawImage(jpgImage, { x: 0, y: 0, width: page.w, height: page.h })
      }
      const pdfBytes = await pdfDoc.save()
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

      const form = new FormData()
      form.append('document', pdfBlob, `doc-${Date.now()}.pdf`)
      form.append('pages', pages.length)
      await api.post(`/rows/${row.id}/document`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      pages.forEach(p => URL.revokeObjectURL(p.url))
      setPages([])
      setOpen(false)
      await loadDocs()
      onDocumentAdded?.()
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleCancel = () => {
    pages.forEach(p => URL.revokeObjectURL(p.url))
    setPages([])
    setOpen(false)
    setError(null)
  }

  if (!canView && !canScan) return null

  return (
    <div className="pt-2 border-t border-gray-100">
      {loadingDocs && <p className="text-xs text-gray-400 mb-2">Загрузка документов...</p>}
      {docs && docs.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-medium text-gray-500">Документы</p>
          {docs.map((doc, i) => (
            <div key={doc.id} className="flex items-center justify-between gap-2">
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                📄 Документ {i + 1} ({doc.pages} стр.)
              </a>
              <span className="text-xs text-gray-400">
                {new Date(doc.createdAt).toLocaleString('ru', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {!open && canScan && (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          📎 Добавить документ
        </button>
      )}

      {open && (
        <div className="bg-indigo-50 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-indigo-800">Сканирование документа</p>

          {pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Страниц: {pages.length}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pages.map((p, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={p.url} className="h-24 w-auto rounded border border-gray-200 object-cover" />
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(p.url)
                        setPages(ps => ps.filter((_, j) => j !== i))
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none">
                      ×
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black/40 text-white rounded-b">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 flex-wrap">
            <input ref={inputRef} type="file" accept="image/*"
              capture="environment" className="hidden" onChange={handlePhoto} />
            <button onClick={() => inputRef.current?.click()}
              className="btn-secondary text-xs px-3 py-1.5">
              📷 {pages.length === 0 ? 'Снять страницу' : 'Ещё страница'}
            </button>
            {pages.length > 0 && (
              <button onClick={handleSave} disabled={saving}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                {saving ? '⏳ Сохранение...' : `💾 Сохранить (${pages.length} стр.)`}
              </button>
            )}
            <button onClick={handleCancel}
              className="btn-secondary text-xs px-3 py-1.5">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
