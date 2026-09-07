const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const pool = require('../../config/db')
const { sendPasswordResetEmail } = require('../../services/emailService')
const { normalizarEmail, emailValido, senhaValida } = require('../../utils/authUtils')

async function forgotPassword(req, res) {
  const { email } = req.body || {}
  const emailNormalizado = normalizarEmail(email)

  if (!emailValido(emailNormalizado)) {
    return res.status(400).json({ message: 'Informe o e-mail.' })
  }

  // Sempre responde com sucesso (segurança — não revela se o e-mail existe)
  try {
    const result = await pool.query(
      'SELECT idusuario FROM public.usuario WHERE LOWER(BTRIM(email)) = $1',
      [emailNormalizado]
    )

    if (result.rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('password_reset'), $1::integer)",
          [result.rows[0].idusuario]
        )
        await client.query(
          'UPDATE public.password_reset_tokens SET used = TRUE WHERE usuario_id = $1 AND used = FALSE',
          [result.rows[0].idusuario]
        )
        await client.query(
          `INSERT INTO public.password_reset_tokens (usuario_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [result.rows[0].idusuario, tokenHash, expiresAt]
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      try {
        await sendPasswordResetEmail(emailNormalizado, token)
      } catch (sendErr) {
        console.error('Erro ao enviar e-mail de recuperação:', sendErr.message)
        await pool.query(
          'UPDATE public.password_reset_tokens SET used = TRUE WHERE token_hash = $1',
          [tokenHash]
        )
      }
    }

    return res.status(200).json({
      message: 'Se o e-mail existir, enviaremos um link de recuperação.',
    })
  } catch (err) {
    console.error('Erro em forgotPassword:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body || {}

  if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) {
    return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' })
  }

  if (!senhaValida(password)) {
    return res.status(400).json({ message: 'A senha deve ter entre 8 e 72 caracteres, com letra maiúscula, minúscula, número e caractere especial.' })
  }

  const hash = await bcrypt.hash(password, 10)
  const client = await pool.connect()
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await client.query('BEGIN')
    const result = await client.query(
      `UPDATE public.password_reset_tokens
       SET used = TRUE
       WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()
       RETURNING usuario_id`,
      [tokenHash]
    )

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Token inválido ou expirado.' })
    }

    await client.query(
      `UPDATE public.usuario
       SET senha = $1, token_version = token_version + 1
       WHERE idusuario = $2`,
      [hash, result.rows[0].usuario_id]
    )

    await client.query('COMMIT')

    return res.status(200).json({ message: 'Senha redefinida com sucesso.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro em resetPassword:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { forgotPassword, resetPassword }
