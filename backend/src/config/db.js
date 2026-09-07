<<<<<<< HEAD:Backend/src/config/db.js
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  
  options:  '-c search_path=public',
})

// evita erros de conexão derrubem o servidor
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexão:', err.message)
})

pool.connect()
  .then(client => {
    console.log('Conexão feita com sucesso!!')
    client.release() 
  })
  .catch(err => console.error('Erro ao conectar com o banco de dados:', err.message))

module.exports = pool
=======
const { Pool } = require('pg')

function inteiroEnv(nome, padrao, minimo, maximo) {
  const valor = Number(process.env[nome] || padrao)
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo ? valor : padrao
}

const configuracaoPool = {
  max: inteiroEnv('DB_POOL_MAX', 10, 1, 50),
  idleTimeoutMillis: inteiroEnv('DB_IDLE_TIMEOUT_MS', 30_000, 1_000, 300_000),
  connectionTimeoutMillis: inteiroEnv('DB_CONNECTION_TIMEOUT_MS', 10_000, 1_000, 60_000),
}

function configuracaoPorUrl(connectionString) {
  const url = new URL(connectionString)
  const conexaoSegura = process.env.NODE_ENV === 'production'
    || url.hostname === 'neon.tech'
    || url.hostname.endsWith('.neon.tech')

  if (conexaoSegura) url.searchParams.set('sslmode', 'verify-full')

  return {
    connectionString: url.toString(),
    ...configuracaoPool,
    ...(conexaoSegura ? { ssl: { rejectUnauthorized: true } } : {}),
  }
}

const pool = process.env.DATABASE_URL
  ? new Pool(configuracaoPorUrl(process.env.DATABASE_URL))
  : new Pool({
      ...configuracaoPool,
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...(process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    })

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexão:', err.message)
})

async function verificarConexao() {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

module.exports = pool
module.exports.verificarConexao = verificarConexao
>>>>>>> fd3eb50 (Commit Projeto):backend/src/config/db.js
