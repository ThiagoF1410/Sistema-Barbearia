import api, { AVISO_SESSAO_EXPIRADA, AVISO_SESSAO_KEY } from './api'

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

export async function updateMe(data) {
  const response = await api.patch('/auth/me', data)
  return response.data
}

export function saveSession({ token, user }) {
  sessionStorage.removeItem(AVISO_SESSAO_KEY)
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function markSessionExpired() {
  sessionStorage.setItem(AVISO_SESSAO_KEY, AVISO_SESSAO_EXPIRADA)
}

export function saveStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user))
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
