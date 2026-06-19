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