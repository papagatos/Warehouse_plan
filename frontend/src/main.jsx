import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Сборщик ошибок ─────────────────────────────────────────
const sendError = (message, stack, url) => {
  try {
    const token = localStorage.getItem('token')
    if (!token) return // не авторизован — не отправляем
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: String(message).slice(0, 300),
        stack:   String(stack || '').slice(0, 500),
        url:     window.location.pathname,
        userAgent: navigator.userAgent,
      })
    }).catch(() => {}) // молча игнорируем если не доставилось
  } catch {}
}

// JS-ошибки
window.onerror = (message, source, lineno, colno, error) => {
  sendError(message, error?.stack, window.location.pathname)
  return false
}

// Упавшие Promise
window.addEventListener('unhandledrejection', (e) => {
  sendError(
    e.reason?.message || String(e.reason),
    e.reason?.stack,
    window.location.pathname
  )
})

// ── Service Worker ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.log('SW error:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
