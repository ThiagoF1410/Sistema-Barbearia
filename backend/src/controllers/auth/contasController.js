const bcrypt = require('bcryptjs')
const pool = require('../../config/db')
const { resolveRole, signToken, normalizarEmail, emailValido, senhaValida } = require('../../utils/authUtils')

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

  if (!senhaValida(password)) {
    return res.status(400).json({ message: 'A senha deve ter entre 8 e 72 caracteres, com letra maiúscula, minúscula, número e caractere especial.' })
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

    if (role === 'profissional_inativo') {
      return res.status(403).json({ message: 'Este acesso profissional está inativo. Entre em contato com a administração.' })
    }
    if (!role) {
      return res.status(403).json({ message: 'Não foi possível identificar um perfil autorizado para esta conta.' })
    }

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

function validarDadosPerfil(body = {}) {
  const { nome, email, telefone } = body
  const nomeNormalizado = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : ''
  const emailNormalizado = normalizarEmail(email)
  const telefoneNormalizado = typeof telefone === 'string' ? telefone.replace(/\D/g, '') : ''

  if (!nomeNormalizado || !emailNormalizado || !telefoneNormalizado) {
    return { erro: 'Preencha nome, e-mail e telefone.' }
  }
  if (nomeNormalizado.length < 2 || nomeNormalizado.length > 100) {
    return { erro: 'O nome deve ter entre 2 e 100 caracteres.' }
  }
  if (!emailValido(emailNormalizado) || emailNormalizado.length > 150) {
    return { erro: 'Informe um e-mail válido.' }
  }
  if (!/^\d{10,11}$/.test(telefoneNormalizado)) {
    return { erro: 'Informe um telefone com DDD válido.' }
  }
  return { dados: { nome: nomeNormalizado, email: emailNormalizado, telefone: telefoneNormalizado } }
}

async function updateMe(req, res) {
  if (req.userRole !== 'cliente') {
    return res.status(403).json({ message: 'Somente clientes podem alterar estes dados.' })
  }

  const validacao = validarDadosPerfil(req.body)
  if (validacao.erro) return res.status(400).json({ message: validacao.erro })

  const { nome, email, telefone } = validacao.dados
  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true

    const duplicado = await client.query(
      `SELECT 1 FROM public.usuario
       WHERE LOWER(BTRIM(email)) = $1 AND idusuario <> $2
       LIMIT 1`,
      [email, req.userId]
    )
    if (duplicado.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }

    const usuario = await client.query(
      `UPDATE public.usuario
       SET nome = $1, email = $2
       WHERE idusuario = $3
       RETURNING idusuario, nome, email`,
      [nome, email, req.userId]
    )
    const cliente = await client.query(
      `UPDATE public.cliente
       SET telefone = $1
       WHERE usuario_idusuario = $2
       RETURNING telefone`,
      [telefone, req.userId]
    )

    if (!usuario.rows.length || !cliente.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Cliente não encontrado.' })
    }

    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(200).json({
      ...usuario.rows[0],
      telefone: cliente.rows[0].telefone,
      role: 'cliente',
    })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ message: 'E-mail já cadastrado.' })
    console.error('Erro ao atualizar perfil:', err)
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

module.exports = { register, login, getMe, updateMe, listarUsuarios, validarDadosPerfil }
