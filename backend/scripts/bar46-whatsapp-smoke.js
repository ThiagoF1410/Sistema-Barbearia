require('dotenv').config()

const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'

async function identidade(tabela, condicao = '') {
  const resultado = await pool.query(
    `SELECT u.idusuario, u.email, u.token_version
     FROM public.usuario u
     JOIN public.${tabela} p ON p.usuario_idusuario = u.idusuario
     ${condicao}
     ORDER BY u.idusuario LIMIT 1`
  )
  return resultado.rows[0]
}

function token(usuario, role) {
  return signToken({
    id: usuario.idusuario,
    email: usuario.email,
    role,
    tokenVersion: usuario.token_version,
  })
}

async function chamar(caminho, jwt, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwt}`,
    },
  })
  const corpo = await resposta.json()
  return { status: resposta.status, corpo }
}

async function main() {
  const [admin, cliente] = await Promise.all([
    identidade('administrador'),
    identidade('cliente'),
  ])
  if (!admin || !cliente) throw new Error('Administrador e cliente são necessários para o teste.')

  const status = await chamar('/whatsapp/status', token(admin, 'admin'))
  const contato = await chamar('/whatsapp/contato', token(cliente, 'cliente'))
  const envio = await chamar('/whatsapp/teste', token(admin, 'admin'), {
    method: 'POST',
    body: '{}',
  })

  const resultados = [
    {
      id: 'CT-WPP-DIAG-01', descricao: 'Consultar conexão como administrador',
      statusHttp: status.status,
      resultado: status.status === 200 && status.corpo?.estado === 'conectado' ? 'APROVADO' : 'REPROVADO',
      detalhe: status.corpo?.estado || '',
    },
    {
      id: 'CT-WPP-DIAG-02', descricao: 'Consultar contato como cliente',
      statusHttp: contato.status,
      resultado: contato.status === 200 && /^https:\/\/wa\.me\/\d+$/.test(contato.corpo?.url || '') ? 'APROVADO' : 'REPROVADO',
    },
    {
      id: 'CT-WPP-DIAG-03', descricao: 'Enviar mensagem de teste pelo Baileys',
      statusHttp: envio.status,
      resultado: envio.status === 200 && Boolean(envio.corpo?.messageId)
        ? 'APROVADO'
        : envio.status === 503
          ? 'BLOQUEADO'
          : 'REPROVADO',
      detalhe: envio.corpo?.message || '',
    },
  ]
  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha inesperada no teste do WhatsApp.', detalhe: erro.message || erro.code }))
    process.exitCode = 1
  })
  .finally(() => pool.end())
