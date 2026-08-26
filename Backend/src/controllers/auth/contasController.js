const bcrypt = require('bcryptjs')
const pool = require('../../config/db')
const { resolveRole, signToken, normalizarEmail, emailValido } = require('../../utils/authUtils')

async function register(req, res) {
  const { nome, email, telefone, password } = req.body || {}
  const emailNormalizado = normalizarEmail(email)
  const telefoneNormalizado = typeof telefone === 'string' ? telefone.replace(/\D/g, '') : ''

  if (typeof nome !== 'string' || typeof email !== 'string' || typeof telefone !== 'string' || typeof password !== 'string'
      || !nome.trim() || !email.trim() || !telefone.trim() || !password) {
    return res.status(400).json({ message: 'Preencha todos os campos.' })
  }

  if (!emailValido(emailNormalizado)) {
    return res.status(400).json({ message: 'Informe um e-mail válido.' })
  }

  if (!/^\d{10,11}$/.test(telefoneNormalizado)) {
    return res.status(400).json({ message: 'Informe um telefone com DDD válido.' })
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'A senha deve ter no mínimo 8 caracteres.' })
  }

  const client = await pool.connect()

  try {
    // Verifica e-mail duplicado
    const existing = await client.query(
      'SELECT idusuario FROM public.usuario WHERE LOWER(BTRIM(email)) = $1',
      [emailNormalizado]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }

    await client.query('BEGIN')

    const hash = await bcrypt.hash(password, 10)

    const result = await client.query(
      `INSERT INTO public.usuario (nome, email, senha)
       VALUES ($1, $2, $3)
       RETURNING idusuario, nome, email, token_version`,
      [nome.trim(), emailNormalizado, hash]
    )
    const usuario = result.rows[0]

    await client.query(
      'INSERT INTO public.cliente (usuario_idusuario, telefone) VALUES ($1, $2)',
      [usuario.idusuario, telefoneNormalizado]
    )

    await client.query('COMMIT')

    const token = signToken({
      id:    usuario.idusuario,
      email: usuario.email,
      role:  'cliente',
      tokenVersion: usuario.token_version,
    })

    return res.status(201).json({
      token,
      user: {
        id:    usuario.idusuario,
        name:  usuario.nome,
        email: usuario.email,
        role:  'cliente',
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }
    console.error('Erro no registro:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function login(req, res) {
  const { email, password } = req.body || {}
  const emailNormalizado = normalizarEmail(email)

  if (typeof email !== 'string' || typeof password !== 'string' || !emailNormalizado || !password) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' })
  }

  const client = await pool.connect()

  try {
    const result = await client.query(
      `SELECT idusuario, nome, email, senha, token_version
       FROM public.usuario
       WHERE LOWER(BTRIM(email)) = $1`,
      [emailNormalizado]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
    }

    const usuario = result.rows[0]
    const senhaCorreta = await bcrypt.compare(password, usuario.senha)

    if (!senhaCorreta) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
    }

    
    const role = await resolveRole(client, usuario.idusuario)

    const token = signToken({
      id:    usuario.idusuario,
      email: usuario.email,
      role,
      tokenVersion: usuario.token_version,
    })

    return res.status(200).json({
      token,
      user: {
        id:    usuario.idusuario,
        name:  usuario.nome,
        email: usuario.email,
        role,
      },
    })
  } catch (err) {
    console.error('Erro no login:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function getMe(req, res) {
  const client = await pool.connect()
  try {
    if (req.userRole === 'admin') {
      const result = await client.query(
        `SELECT u.idusuario, u.nome, u.email, 'admin' AS role
         FROM public.usuario u
         JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
         WHERE u.idusuario = $1`,
        [req.userId]
      )
      if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' })
      return res.status(200).json(result.rows[0])
    }

    if (req.userRole === 'profissional') {
      const result = await client.query(
        `SELECT u.idusuario, u.nome, u.email, p.especialidade, 'profissional' AS role
         FROM public.usuario u
         JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
         WHERE u.idusuario = $1`,
        [req.userId]
      )
      if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' })
      return res.status(200).json(result.rows[0])
    }

    // cliente (default)
    const result = await client.query(
      `SELECT u.idusuario, u.nome, u.email, c.telefone, 'cliente' AS role
       FROM public.usuario u
       JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
       WHERE u.idusuario = $1`,
      [req.userId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' })
    return res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('Erro no getMe:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function listarUsuarios(req, res) {
  try {
    const result = await pool.query(`
      SELECT u.idusuario, u.nome, u.email,
        CASE
          WHEN a.idadministrador IS NOT NULL THEN 'admin'
          WHEN p.idprofissional IS NOT NULL THEN 'profissional'
          ELSE 'cliente'
        END AS role
      FROM public.usuario u
      LEFT JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
      LEFT JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
      ORDER BY u.nome, u.idusuario
    `)
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar usuários:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { register, login, getMe, listarUsuarios }
