const AMBIENTES = new Set(['development', 'test', 'production'])
const MODOS_STRIPE = new Set(['test', 'live'])
const BOOLEANOS = new Set(['true', 'false'])
const PADRAO_SEGREDO = /(change[-_ ]?me|troque|substitua|sua[-_ ]?chave|gere[-_ ]?uma[-_ ]?chave)/i

function booleanoEnv(nome, padrao = false) {
  const valor = process.env[nome]
  if (valor === undefined || valor === '') return padrao
  if (!BOOLEANOS.has(valor)) {
    throw new Error(`${nome} deve ser true ou false.`)
  }
  return valor === 'true'
}

function urlValida(valor, nome) {
  try {
    return new URL(valor)
  } catch {
    throw new Error(`${nome} deve conter uma URL válida.`)
  }
}

function validarDuracaoJwt(valor, nome = 'JWT_EXPIRES_IN', maximoSegundos = 30 * 86400) {
  const correspondencia = /^(\d+)([smhd])$/.exec(valor)
  if (!correspondencia) throw new Error(nome + ' deve usar um valor como 15m, 12h ou 7d.')
  const quantidade = Number(correspondencia[1])
  const fatores = { s: 1, m: 60, h: 3600, d: 86400 }
  const segundos = quantidade * fatores[correspondencia[2]]
  if (!Number.isSafeInteger(segundos) || segundos < 300 || segundos > maximoSegundos) {
    throw new Error(nome + ' deve estar entre 5 minutos e ' + (maximoSegundos / 3600) + ' horas.')
  }
}

function validarAmbiente() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (!AMBIENTES.has(nodeEnv)) {
    throw new Error('NODE_ENV deve ser development, test ou production.')
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve estar configurado com pelo menos 32 caracteres.')
  }
  if (nodeEnv === 'production' && PADRAO_SEGREDO.test(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET de produção não pode usar um valor de exemplo.')
  }
  validarDuracaoJwt(process.env.JWT_ACCESS_EXPIRES_IN || '15m', 'JWT_ACCESS_EXPIRES_IN', 3600)

  if (!process.env.DATABASE_URL && !(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD)) {
    throw new Error('Configure DATABASE_URL ou todas as variáveis DB_HOST, DB_NAME, DB_USER e DB_PASSWORD.')
  }
  if (process.env.DATABASE_URL) {
    const database = urlValida(process.env.DATABASE_URL, 'DATABASE_URL')
    if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
      throw new Error('DATABASE_URL deve usar o protocolo postgres ou postgresql.')
    }
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const frontend = urlValida(frontendUrl, 'FRONTEND_URL')
  if (nodeEnv === 'production' && frontend.protocol !== 'https:') {
    throw new Error('FRONTEND_URL deve usar HTTPS em produção.')
  }

  const stripeMode = process.env.STRIPE_MODE || 'test'
  if (!MODOS_STRIPE.has(stripeMode)) {
    throw new Error('STRIPE_MODE deve ser test ou live.')
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey) {
    const prefixoEsperado = stripeMode === 'live' ? 'sk_live_' : 'sk_test_'
    if (!stripeKey.startsWith(prefixoEsperado)) {
      throw new Error(`STRIPE_SECRET_KEY não corresponde ao STRIPE_MODE=${stripeMode}.`)
    }
  } else if (nodeEnv === 'production') {
    throw new Error('STRIPE_SECRET_KEY deve estar configurada em produção.')
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET deve começar com whsec_.')
  }
  if (nodeEnv === 'production' && !webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET deve estar configurado em produção.')
  }

  if (nodeEnv === 'production' && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    throw new Error('EMAIL_USER e EMAIL_PASS devem estar configurados em produção.')
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587)
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT deve conter uma porta válida.')
  }

  const whatsappEnabled = booleanoEnv('WHATSAPP_ENABLED')
  const whatsappTestEndpointEnabled = booleanoEnv('WHATSAPP_TEST_ENDPOINT_ENABLED')
  const allowPrivateNetworkOrigins = nodeEnv !== 'production'
    && booleanoEnv('CORS_ALLOW_PRIVATE_NETWORK')
  if (whatsappTestEndpointEnabled && !whatsappEnabled) {
    throw new Error('WHATSAPP_ENABLED deve ser true para habilitar o endpoint de teste.')
  }

  if (whatsappEnabled) {
    const whatsappTimeoutMs = Number(process.env.WHATSAPP_TIMEOUT_MS || 10_000)
    if (!Number.isInteger(whatsappTimeoutMs) || whatsappTimeoutMs < 1000 || whatsappTimeoutMs > 30_000) {
      throw new Error('WHATSAPP_TIMEOUT_MS deve ser um inteiro entre 1000 e 30000.')
    }
    const whatsappReconnectMs = Number(process.env.WHATSAPP_RECONNECT_MS || 5_000)
    if (!Number.isInteger(whatsappReconnectMs) || whatsappReconnectMs < 1000 || whatsappReconnectMs > 60_000) {
      throw new Error('WHATSAPP_RECONNECT_MS deve ser um inteiro entre 1000 e 60000.')
    }
    const whatsappNotificationIntervalMs = Number(process.env.WHATSAPP_NOTIFICATION_INTERVAL_MS || 30_000)
    if (
      !Number.isInteger(whatsappNotificationIntervalMs)
      || whatsappNotificationIntervalMs < 5_000
      || whatsappNotificationIntervalMs > 300_000
    ) {
      throw new Error('WHATSAPP_NOTIFICATION_INTERVAL_MS deve ser um inteiro entre 5000 e 300000.')
    }
  }

  if (whatsappTestEndpointEnabled) {
    if (!/^55[1-9]\d\d{8,9}$/.test(process.env.WHATSAPP_TEST_RECIPIENT?.trim() || '')) {
      throw new Error('WHATSAPP_TEST_RECIPIENT deve usar 55 + DDD + número, somente dígitos.')
    }
    const mensagemTeste = process.env.WHATSAPP_TEST_MESSAGE?.trim()
    if (mensagemTeste && Array.from(mensagemTeste).length > 4096) {
      throw new Error('WHATSAPP_TEST_MESSAGE deve conter no máximo 4096 caracteres.')
    }
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    frontendUrl: frontend.origin,
    allowPrivateNetworkOrigins,
    stripeMode,
    whatsappEnabled,
  }
}

module.exports = { validarAmbiente }
