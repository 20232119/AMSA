// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) { setLoading(false); return }
    try {
      const data = await api.get('/auth/me')
      setUser(data)
    } catch {
      localStorage.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  async function login(identifier, password) {
    const data = await api.post('/auth/login', { identifier, password })
    localStorage.setItem('accessToken',  data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser(data.user)
    return data.user
  }

async function loginBiometric(identifier) {
  const opts = await api.post('/auth/webauthn/authenticate/options', { identifier })
  const { userId, ...optionsJSON } = opts  // ← rename here

  const { startAuthentication } = await import('@simplewebauthn/browser')
  const assertion = await startAuthentication({ optionsJSON })  // ← now matches

  const data = await api.post('/auth/webauthn/authenticate/verify', { userId, ...assertion })
  localStorage.setItem('accessToken',  data.accessToken)
  localStorage.setItem('refreshToken', data.refreshToken)
  setUser(data.user)
  return data.user
}

  async function logout() {
    const rt = localStorage.getItem('refreshToken')
    try { await api.post('/auth/logout', { refreshToken: rt }) } catch { /* ignore */ }
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginBiometric, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
