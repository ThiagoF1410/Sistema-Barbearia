import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
let accessToken = null
let renovacaoEmAndamento = null

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const MENSAGENS_HTTP = {
  400: 'Não foi possível processar os dados enviados. Revise as informações e tente novamente.',
  401: 'Não foi possível autenticar sua solicitação. Entre novamente para continuar.',
  403: 'Você não possui permissão para realizar esta operação.',
  404: 'A informação solicitada não foi encontrada.',
  409: 'Não foi possível concluir a operação devido a um conflito nos dados.',
  429: 'Muitas solicitações foram realizadas em pouco tempo. Aguarde alguns instantes e tente novamente.',
}

const MENSAGEM_INDISPONIVEL = 'O serviço está temporariamente indisponível. Aguarde alguns instantes e tente novamente.'
const MENSAGEM_CONEXAO = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
const MENSAGEM_TIMEOUT = 'A solicitação demorou mais que o esperado. Verifique sua conexão e tente novamente.'
const MENSAGEM_INTERNA = 'Não foi possível concluir a operação no momento. Tente novamente mais tarde.'
const PADRAO_TECNICO = /(request failed|network error|econn|aggregateerror|status code|timeout of|sql|syntax error|column .*does not exist|relation .*does not exist|internal server error)/i
const ROTAS_SEM_RENOVACAO = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

export const AVISO_SESSAO_KEY = 'auth-session-notice'
export const AVISO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente para continuar.'

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token ? token : null
}

export function clearAccessToken() {
  accessToken = null
}

export function getAccessToken() {
  return accessToken
}

export function mensagemPublicaDoErro(error) {
  const status = error?.response?.status
  if (!error?.response) {
    return error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')
      ? MENSAGEM_TIMEOUT
      : MENSAGEM_CONEXAO
  }
  if ([502, 503, 504].includes(status)) return MENSAGEM_INDISPONIVEL
  if (status >= 500) return MENSAGEM_INTERNA

  const mensagemBackend = error.response?.data?.message
  if (typeof mensagemBackend === 'string' && mensagemBackend.trim() && !PADRAO_TECNICO.test(mensagemBackend)) {
    return mensagemBackend.trim()
  }
  return MENSAGENS_HTTP[status] || MENSAGEM_INTERNA
}

function notificarSessaoRenovada(dados) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-renewed', { detail: dados }))
  }
}

async function renovarAccessToken() {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = axios.post(`${API_BASE_URL}/auth/refresh`, null, {
      timeout: 15000,
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => {
      setAccessToken(response.data?.token)
      notificarSessaoRenovada(response.data)
      return response.data?.token
    }).finally(() => {
      renovacaoEmAndamento = null
    })
  }
  return renovacaoEmAndamento
}

function encerrarSessaoLocal() {
  clearAccessToken()
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  sessionStorage.removeItem('auth-session')
  sessionStorage.setItem(AVISO_SESSAO_KEY, AVISO_SESSAO_EXPIRADA)
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const url = error.config?.url
    const podeRenovar = status === 401
      && url
      && !ROTAS_SEM_RENOVACAO.includes(url)
      && !error.config?._tentouRenovar

    if (podeRenovar) {
      try {
        error.config._tentouRenovar = true
        const token = await renovarAccessToken()
        if (token) {
          error.config.headers.Authorization = `Bearer ${token}`
          return api(error.config)
        }
      } catch {
        // A falha é tratada abaixo como sessão encerrada.
      }
    }

    const mensagem = mensagemPublicaDoErro(error)
    error.message = mensagem
    if (error.response) {
      const dados = error.response.data && typeof error.response.data === 'object' ? error.response.data : {}
      error.response.data = { ...dados, message: mensagem }
    } else {
      error.response = { status: 0, data: { message: mensagem } }
    }

    if (status === 401 && url && !ROTAS_SEM_RENOVACAO.includes(url)) {
      encerrarSessaoLocal()
      window.location.replace('/login?motivo=sessao-expirada')
    }
    return Promise.reject(error)
  }
)

export default api
