<<<<<<< HEAD:Frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'stitch_token'
const USER_KEY  = 'stitch_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,  setUser]  = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const isAuthenticated = !!token && !!user

  // Sincroniza estado com localStorage sempre que mudar
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  }, [user])

  // Chamado após login bem-sucedido (recebe dados da API)
  function login({ token: newToken, user: newUser }) {
    setToken(newToken)
    setUser(newUser)
  }

  // Limpa sessão
  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook de conveniência
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
=======
import { createContext, useContext, useState, useEffect } from 'react'
import { login, register, getMe, saveSession, clearSession, getStoredUser } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(getStoredUser)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))

  // quando carregar a página valida o token e atualiza os dados do usuário
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    getMe()
      .then((data) => setUser(data))
      .catch(() => {
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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login:    handleLogin,
      register: handleRegister,
      logout:   handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// O hook fica junto do provider para manter uma única API pública de autenticação.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
>>>>>>> fd3eb50 (Commit Projeto):frontend/src/context/AuthContext.jsx
