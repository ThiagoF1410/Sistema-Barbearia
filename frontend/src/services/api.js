import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Interceptor de requisição — injeta o token JWT se existir
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('stitch_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Interceptor de resposta — trata erros globais
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status

    // Token expirado ou inválido → limpa sessão e redireciona
    if (status === 401) {
      localStorage.removeItem('stitch_token')
      localStorage.removeItem('stitch_user')
      window.location.href = '/login'
    }

    // Extrai mensagem de erro amigável do backend
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Erro inesperado. Tente novamente.'

    return Promise.reject(new Error(message))
  }
)

export default api