require('dotenv').config()

const pool = require('../src/config/db')

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const alvos = await client.query(`SELECT u.idusuario, c.idcliente,
        (SELECT COUNT(*)::integer FROM public.agendamento a WHERE a.cliente_idcliente = c.idcliente) AS agendamentos,
        (SELECT COUNT(*)::integer FROM public.pedido p WHERE p.cliente_idcliente = c.idcliente) AS pedidos
      FROM public.usuario u
      JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      WHERE u.email LIKE 'bar46.wizard.%'
         OR u.email LIKE 'bar46.senha.%'
         OR u.email LIKE 'bar46.stripe.%'
         OR u.email LIKE 'bar46.retorno.%'
         OR u.email LIKE 'bar46.mensagens.%'
         OR u.email LIKE 'bar46.cartao.%'
         OR u.email LIKE 'bar46.aba.%'
      FOR UPDATE OF u, c`)
    if (alvos.rows.some((item) => item.agendamentos !== 0 || item.pedidos !== 0)) {
      throw new Error('Limpeza recusada: existe conta temporaria com agendamento ou pedido vinculado.')
    }
    const usuarios = alvos.rows.map((item) => item.idusuario)
    const clientes = alvos.rows.map((item) => item.idcliente)
    if (usuarios.length) await client.query('DELETE FROM public.password_reset_tokens WHERE usuario_id = ANY($1::integer[])', [usuarios])
    if (clientes.length) await client.query('DELETE FROM public.cliente WHERE idcliente = ANY($1::integer[])', [clientes])
    if (usuarios.length) await client.query('DELETE FROM public.usuario WHERE idusuario = ANY($1::integer[])', [usuarios])
    await client.query('COMMIT')
    console.log(JSON.stringify({ contasRemovidas: usuarios.length, usuarios, clientes }))
  } catch (erro) {
    await client.query('ROLLBACK')
    throw erro
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((erro) => {
  console.error(erro.message)
  process.exitCode = 1
})
