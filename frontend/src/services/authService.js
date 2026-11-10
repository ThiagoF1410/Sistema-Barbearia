import api, {
  AVISO_SESSAO_EXPIRADA,
  AVISO_SESSAO_KEY,
  clearAccessToken,
  setAccessToken,
} from './api'

let renovacaoSessaoEmAndamento = null

export async function register(data) {
  const response = await api.post('/auth/register', data)
  return response.data
}

export async function login(data) {
  const response = await api.post('/auth/login', data)
  return response.data
}

export function refreshSession() {
  if (!renovacaoSessaoEmAndamento) {
    renovacaoSessaoEmAndamento = api.post('/auth/refresh')
      .then((response) => response.data)
      .finally(() => {
        renovacaoSessaoEmAndamento = null
      })
  }
  return renovacaoSessaoEmAndamento
}

export async function logoutSession() {
  const response = await api.post('/auth/logout')
  return response.data
}

export async function getMe() {
  const response = await api.get('/auth/me')
  return response.data
}

export async function updateMe(data) {
  const response = await api.patch('/auth/me', data)
  return response.data
}

export function saveSession({ token, user, session }) {
  sessionStorage.removeItem(AVISO_SESSAO_KEY)
  localStorage.removeItem('token')
  setAccessToken(token)
  if (user) localStorage.setItem('user', JSON.stringify(user))
  if (session) sessionStorage.setItem('auth-session', JSON.stringify(session))
}

export function clearSession() {
  clearAccessToken()
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  sessionStorage.removeItem('auth-session')
}

export function markSessionExpired() {
  sessionStorage.setItem(AVISO_SESSAO_KEY, AVISO_SESSAO_EXPIRADA)
}

export function saveStoredUser(user) {
  if (user) localStorage.setItem('user', JSON.stringify(user))
  else localStorage.removeItem('user')
}

export function getStoredUser() {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }
}

export function getStoredSession() {
  const raw = sessionStorage.getItem('auth-session')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    sessionStorage.removeItem('auth-session')
    return null
  }
}
