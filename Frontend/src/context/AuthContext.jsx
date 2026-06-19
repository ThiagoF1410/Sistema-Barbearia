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