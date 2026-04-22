import React, { useState } from 'react'
import { Camera, X, ZoomIn } from 'lucide-react'
import { photosApi } from '../api/index.js'
import { useRole } from '../api/auth.jsx'

// Кто может грузить какой тип фото
const PHOTO_PERMISSIONS = {
  ARRIVAL:  ['SUPER', 'RECEIVER'],
  ASSEMBLY: ['SUPER', 'WAREHOUSE'],
  SHIPMENT: ['SUPER', 'LOADER'],
}

// Для каких типов строк нужны какие фото
const ROW_PHOTO_TYPES = {
  ARRIVAL:   ['ARRIVAL'],
  CONTAINER: ['ASSEMBLY', 'SHIPMENT'],
  DELIVERY:  ['ASSEMBLY', 'SHIPMENT'],
  PICKUP:    ['ASSEMBLY', 'SHIPMENT'],
  RETURN:    ['ARRIVAL'],
}

const PHOTO_TYPE_LABELS = {
  ARRIVAL:  'Фото приёмки',
  ASSEMBLY: 'Фото сборки',
  SHIPMENT: 'Фото отгрузки',
}

export default function PhotoUpload({ row, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox]   = useState(null)
  const [error, setError]         = useState(null)
  const { role } = useRole()

  const photos = row.photos || []
  const photoTypes = ROW_PHOTO_TYPES[row.rowType] || []

  const canUpload = (photoType) =>
    PHOTO_PERMISSIONS[photoType]?.includes(role)

  const handleUpload = async (e, photoType) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      await photosApi.upload(row.id, files, photoType)
      // Перезагружаем строку (родитель обновит данные)
      onUpdate({ ...row, _needsRefresh: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка загрузки фото')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (photoTypes.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Фотографии</p>

      {photoTypes.map(photoType => {
        const typePhotos = photos.filter(p => p.photoType === photoType)
        const canUp = canUpload(photoType)

        return (
          <div key={photoType} className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">{PHOTO_TYPE_LABELS[photoType]}</span>
              {canUp && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleUpload(e, photoType)}
                    disabled={uploading}
                  />
                  <span className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <Camera className="w-3.5 h-3.5" />
                    {uploading ? 'Загрузка...' : 'Добавить'}
                  </span>
                </label>
              )}
            </div>

            {typePhotos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {typePhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setLightbox(photo.fileUrl)}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors group"
                  >
                    <img
                      src={photo.fileUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-300 italic">Нет фото</p>
            )}
          </div>
        )
      })}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {/* Лайтбокс */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightbox(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
