import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  // При загрузке приложения проверяем сохранённый токен
  useEffect(() => {
    const token = localStorage.getItem('token')
    const saved = localStorage.getItem('user')
    if (token && saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const data = await authApi.login(email, password)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value = { user, loading, login, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Хелперы для проверки ролей
export function useRole() {
  const { user } = useAuth()
  return {
    isSuper:     user?.role === 'SUPER',
    isWarehouse: user?.role === 'WAREHOUSE',
    isLoader:    user?.role === 'LOADER',
    isReceiver:  user?.role === 'RECEIVER',
    canEdit:     user && user.role !== 'VIEWER',
    role:        user?.role,
  }
}
