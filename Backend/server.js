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
