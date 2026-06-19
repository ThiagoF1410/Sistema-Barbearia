const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')

async function register(req, res) {
  const { nome, email, telefone, password } = req.body

  if (!nome || !email || !telefone || !password) {
    return res.status(400).json({ message: 'Preencha todos os campos.' })
  }

  const client = await pool.connect()

  try {
    const existing = await client.query(
      'SELECT idusuario FROM public.usuario WHERE email = $1',
      [email]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'E-mail já cadastrado, informe outro e-mail.' })
    }

    await client.query('BEGIN')

    const hash = await bcrypt.hash(password, 10)

    const result = await client.query(
      `INSERT INTO public.usuario (nome, email, senha)
      VALUES ($1, $2, $3)
      RETURNING idusuario, nome, email`,
      [nome, email, hash]
    )

    const usuario = result.rows[0]

    await client.query(
      'INSERT INTO public.cliente (usuario_idusuario, telefone) VALUES ($1, $2)',
      [usuario.idusuario, telefone]
    )

    await client.query('COMMIT')

    const token = jwt.sign(
      { id: usuario.idusuario, email: usuario.email, role: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(201).json({
      token,
      user: {
        id:    usuario.idusuario,
        name:  usuario.nome,
        email: usuario.email,
        role:  'cliente'
      }
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' })
  }

  try {
    const result = await pool.query(
      'SELECT idusuario, nome, email, senha FROM usuario WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
    }

    const usuario = result.rows[0]
    const senhaCorreta = await bcrypt.compare(password, usuario.senha)

    if (!senhaCorreta) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
    }

    const token = jwt.sign(
      { id: usuario.idusuario, email: usuario.email, role: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      token,
      user: {
        id:    usuario.idusuario,
        name:  usuario.nome,
        email: usuario.email,
        role:  'cliente'
      }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.idusuario, u.nome, u.email, c.telefone
       FROM public.usuario u
       JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
       WHERE u.idusuario = $1`,
      [req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' })
    }

    return res.status(200).json(result.rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { register, login, getMe }