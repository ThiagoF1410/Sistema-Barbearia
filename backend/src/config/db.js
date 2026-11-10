const { registrarErro } = require('../utils/logger')
const { Pool } = require('pg')

function configuracaoPorUrl(connectionString) {
  const url = new URL(connectionString)
  const conexaoSegura = process.env.NODE_ENV === 'production'
    || url.hostname === 'neon.tech'
    || url.hostname.endsWith('.neon.tech')

  if (conexaoSegura) url.searchParams.set('sslmode', 'verify-full')

  return {
    connectionString: url.toString(),
    ...(conexaoSegura ? { ssl: { rejectUnauthorized: true } } : {}),
  }
}

const pool = process.env.DATABASE_URL
  ? new Pool(configuracaoPorUrl(process.env.DATABASE_URL))
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...(process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    })

pool.on('error', (err) => {
  registrarErro('Erro inesperado no pool de conexão:', err)
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
