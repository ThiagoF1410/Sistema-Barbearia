import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
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
export const AVISO_SESSAO_KEY = 'auth-session-notice'
export const AVISO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente para continuar.'

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})


api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url
    const mensagem = mensagemPublicaDoErro(error)

    error.message = mensagem
    if (error.response) {
      const dados = error.response.data && typeof error.response.data === 'object' ? error.response.data : {}
      error.response.data = { ...dados, message: mensagem }
    } else {
      error.response = { status: 0, data: { message: mensagem } }
    }

    // Não redireciona automaticamente em falhas de login/cadastro,
    // para que a página possa exibir a mensagem de erro.
    if (status === 401 && url && !['/auth/login', '/auth/register'].includes(url)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.setItem(AVISO_SESSAO_KEY, AVISO_SESSAO_EXPIRADA)
      window.location.replace('/login?motivo=sessao-expirada')
    }
    return Promise.reject(error)
  }
)

export default api
