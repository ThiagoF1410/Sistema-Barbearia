<<<<<<< HEAD:Backend/server.js
require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const authRoutes = require('./src/routes/authRoutes')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  console.log('Headers:', req.headers.authorization)
  next()
})

app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'API Barbearia funcionando !!'})
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
=======
require('dotenv').config()

const express = require('express')
const cors = require('cors')
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
const whatsappRoutes = require('./src/routes/whatsappRoutes')
const pagamentosController = require('./src/controllers/pagamentosController')
const { obterClienteWhatsApp } = require('./src/services/whatsappService')
const {
  obterProcessadorNotificacoesWhatsapp,
} = require('./src/services/notificacoesWhatsappService')

const app = express()
const PORT = process.env.PORT || 3001

if (ambiente.isProduction) app.set('trust proxy', 1)

app.use(criarHttpsMiddleware(ambiente.isProduction))
app.use(criarCabecalhosSeguros(ambiente.isProduction))

const allowedOrigins = [
  ambiente.frontendUrl,
  ...(!ambiente.isProduction ? ['http://localhost:5173', 'http://localhost:3000'] : []),
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))

// A assinatura da Stripe exige o corpo bruto antes do express.json().
app.post(
  '/api/pagamentos/webhook',
  express.raw({ type: 'application/json' }),
  pagamentosController.webhookStripe
)

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/servicos', servicosRoutes)
app.use('/api/agenda', agendaRoutes)
app.use('/api/profissionais', profissionaisRoutes)
app.use('/api/agendamentos', agendamentosRoutes)
app.use('/api/pagamentos', pagamentosRoutes)
app.use('/api/whatsapp', whatsappRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'API Barbearia funcionando!' })
})

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err.message)
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
  if (ambiente.whatsappEnabled) {
    try {
      await obterClienteWhatsApp().iniciar()
      obterProcessadorNotificacoesWhatsapp().iniciar()
    } catch (err) {
      console.warn('WhatsApp não foi iniciado:', { codigo: err.code || 'WHATSAPP_CONNECTION_ERROR' })
    }
  }
  return app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} (${ambiente.nodeEnv}, Stripe ${ambiente.stripeMode})`)
  })
}

if (require.main === module) {
  iniciarServidor().catch((err) => {
    console.error('Não foi possível iniciar o servidor:', err.message)
    process.exitCode = 1
  })
}

module.exports = { app, iniciarServidor }
>>>>>>> fd3eb50 (Commit Projeto):backend/server.js
