import { createContext, useContext, useEffect, useState } from 'react'
import SessionExpiryMonitor from '../components/SessionExpiryMonitor'
import {
  clearSession,
  getMe,
  getStoredSession,
  getStoredUser,
  login,
  logoutSession,
  markSessionExpired,
  refreshSession,
  register,
  saveSession,
  saveStoredUser,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(getStoredSession)
  const [loading, setLoading] = useState(() => Boolean(getStoredUser()))

  useEffect(() => {
    const usuarioAnterior = getStoredUser()

    if (!usuarioAnterior) {
      clearSession()
      return
    }

    refreshSession()
      .then(async (data) => {
        saveSession(data)
        setSession(data.session || null)
        try {
          const perfil = await getMe()
          setUser(perfil)
          saveStoredUser(perfil)
        } catch {
          setUser(data.user)
          saveStoredUser(data.user)
        }
      })
      .catch(() => {
        if (usuarioAnterior) markSessionExpired()
        clearSession()
        setUser(null)
        setSession(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function sessaoRenovada(event) {
      const data = event.detail
      if (!data?.user) return
      saveSession(data)
      setUser((atual) => atual ? { ...data.user, ...atual } : data.user)
      setSession(data.session || null)
    }
    window.addEventListener('auth:session-renewed', sessaoRenovada)
    return () => window.removeEventListener('auth:session-renewed', sessaoRenovada)
  }, [])

  async function handleLogin(credentials) {
    const data = await login(credentials)
    saveSession(data)
    setUser(data.user)
    setSession(data.session || null)
    return data.user
  }

  async function handleRegister(formData) {
    const data = await register(formData)
    saveSession(data)
    setUser(data.user)
    setSession(data.session || null)
    return data.user
  }

  function handleLogout() {
    const encerramento = logoutSession().catch(() => null)
    clearSession()
    setUser(null)
    setSession(null)
    return encerramento
  }

  async function handleSessionRefresh() {
    const data = await refreshSession()
    saveSession(data)
    setUser((atual) => atual ? { ...data.user, ...atual } : data.user)
    setSession(data.session || null)
    return data
  }

  function handleUserUpdate(data) {
    setUser(data)
    saveStoredUser(data)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated: !!user,
      login: handleLogin,
      register: handleRegister,
      refreshSession: handleSessionRefresh,
      updateUser: handleUserUpdate,
      logout: handleLogout,
    }}>
      {children}
      <SessionExpiryMonitor
        user={user}
        session={session}
        onRefresh={handleSessionRefresh}
        onLogout={handleLogout}
      />
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
