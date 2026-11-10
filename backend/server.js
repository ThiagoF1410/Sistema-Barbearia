const { registrarErro } = require('./src/utils/logger')
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const compression = require('compression')
const { validarAmbiente } = require('./src/config/env')
const ambiente = validarAmbiente()
const pool = require('./src/config/db')
const { criarHttpsMiddleware, criarCabecalhosSeguros } = require('./src/middlewares/httpsMiddleware')

const authRoutes = require('./src/routes/authRoutes')
const clientesRoutes = require('./src/routes/clientesRoutes')
const servicosRoutes = require('./src/routes/servicosRoutes')
const agendaRoutes = require('./src/routes/agendaRoutes')
const profissionaisRoutes = require('./src/routes/profissionaisRoutes')
const agendamentosRoutes = require('./src/routes/agendamentosRoutes')
const pagamentosRoutes = require('./src/routes/pagamentosRoutes')
const pedidosRoutes = require('./src/routes/pedidosRoutes')
const whatsappRoutes = require('./src/routes/whatsappRoutes')
const notificacoesRoutes = require('./src/routes/notificacoesRoutes')
const pagamentosController = require('./src/controllers/pagamentosController')
const { obterClienteWhatsApp } = require('./src/services/whatsappService')
const { obterAtendimentoWhatsappService } = require('./src/services/atendimentoWhatsappService')
const {
  obterProcessadorNotificacoesWhatsapp,
} = require('./src/services/notificacoesWhatsappService')
const { obterProcessadorExpiracaoPagamentos } = require('./src/services/expiracaoPagamentosService')

const app = express()
const PORT = process.env.PORT || 3001
let removerManipuladorAtendimento = null

app.disable('x-powered-by')

if (ambiente.isProduction) app.set('trust proxy', 1)

app.use(criarHttpsMiddleware(ambiente.isProduction))
app.use(criarCabecalhosSeguros(ambiente.isProduction))

const allowedOrigins = [
  ambiente.frontendUrl,
  ...(!ambiente.isProduction ? ['http://localhost:5173', 'http://localhost:3000'] : []),
]

function origemLocalDeDesenvolvimento(origin) {
  if (ambiente.isProduction || !ambiente.allowPrivateNetworkOrigins || !origin) return false
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:') return false
    const host = url.hostname
    return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  } catch {
    return false
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origemLocalDeDesenvolvimento(origin)) callback(null, true)
    else callback(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))

app.use(compression({ threshold: 1024 }))

// A assinatura da Stripe exige o corpo bruto antes do express.json().
app.post(
  '/api/pagamentos/webhook',
  express.raw({ type: 'application/json' }),
  pagamentosController.webhookStripe
)

app.use(express.json({ limit: '32kb' }))

app.use('/api/auth', authRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/servicos', servicosRoutes)
app.use('/api/agenda', agendaRoutes)
app.use('/api/profissionais', profissionaisRoutes)
app.use('/api/agendamentos', agendamentosRoutes)
app.use('/api/pagamentos', pagamentosRoutes)
app.use('/api/pedidos', pedidosRoutes)
app.use('/api/whatsapp', whatsappRoutes)
app.use('/api/notificacoes', notificacoesRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'API Barbearia funcionando!' })
})

app.use((err, req, res, next) => {
  registrarErro('Erro não tratado:', err)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'O conteúdo enviado excede o limite permitido.' })
  }
  if (err instanceof SyntaxError && err.status === 400 && Object.hasOwn(err, 'body')) {
    return res.status(400).json({ message: 'JSON inválido.' })
  }
  if (err.message?.startsWith('CORS bloqueado:')) {
    return res.status(403).json({ message: 'Origem não autorizada.' })
  }
  res.status(500).json({ message: 'Erro interno no servidor.' })
})

async function iniciarServidor() {
  await pool.verificarConexao()
  console.log('Conectado ao banco de dados (Neon/PostgreSQL)')
  obterProcessadorExpiracaoPagamentos().iniciar()
  if (ambiente.whatsappEnabled) {
    try {
      const clienteWhatsApp = obterClienteWhatsApp()
      removerManipuladorAtendimento ||= clienteWhatsApp.registrarManipuladorMensagens(
        (mensagem) => obterAtendimentoWhatsappService().processarMensagem(mensagem)
      )
      await clienteWhatsApp.iniciar()
      obterProcessadorNotificacoesWhatsapp().iniciar()
    } catch (err) {
      console.warn('WhatsApp não foi iniciado:', { codigo: err.code || 'WHATSAPP_CONNECTION_ERROR' })
    }
  }
  return app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} (${ambiente.nodeEnv}, Stripe ${ambiente.stripeMode})`)
  })
}

async function encerrarServidor(servidor, sinal) {
  console.log(`Encerrando servidor (${sinal})...`)
  obterProcessadorExpiracaoPagamentos().encerrar()
  obterProcessadorNotificacoesWhatsapp().encerrar()
  removerManipuladorAtendimento?.()
  removerManipuladorAtendimento = null
  await obterClienteWhatsApp().encerrar().catch(() => {})
  if (servidor?.listening) {
    await new Promise((resolve) => servidor.close(resolve))
  }
  await pool.end().catch(() => {})
}

if (require.main === module) {
  iniciarServidor()
    .then((servidor) => {
      let encerrando = false
      const finalizar = (sinal) => {
        if (encerrando) return
        encerrando = true
        encerrarServidor(servidor, sinal)
          .catch((err) => registrarErro('Falha ao encerrar o servidor:', err))
          .finally(() => { process.exitCode = 0 })
      }
      process.once('SIGINT', () => finalizar('SIGINT'))
      process.once('SIGTERM', () => finalizar('SIGTERM'))
    })
    .catch((err) => {
      registrarErro('Não foi possível iniciar o servidor:', err)
      process.exitCode = 1
    })
}

module.exports = { app, iniciarServidor, encerrarServidor }
