const CACHE = 'warehouse-v1'
const OFFLINE_URL = '/'

// При установке — кешируем основные ресурсы
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      '/',
      '/manifest.json',
    ])).then(() => self.skipWaiting())
  )
})

// При активации — удаляем старые кеши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — сеть приоритет, при ошибке — кеш
self.addEventListener('fetch', e => {
  // Только GET запросы, не API
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Кешируем успешные ответы
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match(OFFLINE_URL)))
  )
})
