require('dotenv').config()

const pool = require('../src/config/db')

Promise.all([
  pool.query(`SELECT COUNT(*)::integer AS total
    FROM public.usuario
    WHERE email LIKE 'bar46.wizard.%'
       OR email LIKE 'bar46.senha.%'
       OR email LIKE 'bar46.stripe.%'
       OR email LIKE 'bar46.retorno.%'
       OR email LIKE 'bar46.mensagens.%'
       OR email LIKE 'bar46.cartao.%'
       OR email LIKE 'bar46.aba.%'`),
  pool.query(`SELECT COUNT(*)::integer AS total
    FROM public.notificacao
    WHERE chave_evento LIKE 'ATENDIMENTO_WHATSAPP:BAR46-%'`),
  pool.query(`SELECT u.idusuario, u.email, c.idcliente,
      (SELECT COUNT(*)::integer FROM public.agendamento a WHERE a.cliente_idcliente = c.idcliente) AS agendamentos,
      (SELECT COUNT(*)::integer FROM public.pedido p WHERE p.cliente_idcliente = c.idcliente) AS pedidos
    FROM public.usuario u
    LEFT JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
    WHERE u.email LIKE 'bar46.wizard.%'
       OR u.email LIKE 'bar46.senha.%'
       OR u.email LIKE 'bar46.stripe.%'
       OR u.email LIKE 'bar46.retorno.%'
       OR u.email LIKE 'bar46.mensagens.%'
       OR u.email LIKE 'bar46.cartao.%'
       OR u.email LIKE 'bar46.aba.%'
    ORDER BY u.idusuario`),
]).then(([usuarios, notificacoes, detalhes]) => {
  console.log(JSON.stringify({
    usuariosTemporarios: usuarios.rows[0].total,
    notificacoesTemporarias: notificacoes.rows[0].total,
    detalhes: detalhes.rows,
  }))
}).finally(() => pool.end())
