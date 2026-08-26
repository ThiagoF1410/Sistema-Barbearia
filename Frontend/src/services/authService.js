<<<<<<< HEAD:Frontend/src/services/authService.js
import api from './api'

const authService = {
  /**
   * Registra um novo cliente.
   * @param {{ full_name, email, phone, password }} data
   * @returns {{ token, user }}
   */
  async register(data) {
    const response = await api.post('/auth/register', {
      nome:      data.full_name,
      email:     data.email,
      telefone:  data.phone.replace(/\D/g, ''), // envia apenas dígitos
      password:  data.password,
    })
    return response.data
  },

  /**
   * Autentica um usuário existente.
   * @param {{ email, password }} data
   * @returns {{ token, user }}
   */
  async login(data) {
    const response = await api.post('/auth/login', {
      email:    data.email,
      password: data.password,
    })
    return response.data
  },

  /**
   * Recupera o perfil do usuário autenticado.
   * Requer token no header (configurado automaticamente pelo interceptor em api.js).
   */
  async getMe() {
    const response = await api.get('/auth/me')
    return response.data
  },
}

export default authService
=======
import api from './api'

export async function register(data) {
  const response = await api.post('/auth/register', data)
  return response.data // { token, user }
}

export async function login(data) {
  const response = await api.post('/auth/login', data)
  return response.data // { token, user }
}

export async function getMe() {
  const response = await api.get('/auth/me')
  return response.data // { idusuario, nome, email, role, ... }
}

export function saveSession({ token, user }) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getStoredUser() {
  if (!localStorage.getItem('token')) {
    clearSession()
    return null
  }
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }
}
>>>>>>> fd3eb50 (Commit Projeto):frontend/src/services/authService.js
