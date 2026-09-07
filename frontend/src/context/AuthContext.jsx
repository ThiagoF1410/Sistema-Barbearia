import { createContext, useContext, useState, useEffect } from 'react'
import { login, register, getMe, saveSession, saveStoredUser, clearSession, getStoredUser, markSessionExpired } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    getMe()
      .then((data) => {
        setUser(data)
        saveStoredUser(data)
      })
      .catch((error) => {
        const sessaoFoiInvalidada = error?.response?.status === 401 || !localStorage.getItem('token')
        if (sessaoFoiInvalidada) markSessionExpired()
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogin(credentials) {
    const data = await login(credentials)
    saveSession(data)
    setUser(data.user)
    return data.user
  }

  async function handleRegister(formData) {
    const data = await register(formData)
    saveSession(data)
    setUser(data.user)
    return data.user
  }

  function handleLogout() {
    clearSession()
    setUser(null)
  }

  function handleUserUpdate(data) {
    setUser(data)
    saveStoredUser(data)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login: handleLogin,
      register: handleRegister,
      updateUser: handleUserUpdate,
      logout: handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
