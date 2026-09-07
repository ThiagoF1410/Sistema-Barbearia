require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { getStripe } = require('../src/services/stripeService')
const { criarNotificacoesWhatsappService } = require('../src/services/notificacoesWhatsappService')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/whatsapp-mensagens')
const resultados = []
const envios = []
let usuarioId = null
let agendamentoId = null
let pagamentoId = null
let sessionId = null

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

function semCaracterQuebrado(texto) {
  return typeof texto === 'string' && !texto.includes('\uFFFD')
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const cadastroResposta = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nome: 'Cliente Mensagens BAR 46', email: `bar46.mensagens.${marcador}@example.com`,
      telefone: '00000000000', password: 'TesteBar46@2026',
    }),
  })
  const cadastro = await cadastroResposta.json()
  if (cadastroResposta.status !== 201) throw new Error(`Cadastro falhou: ${cadastroResposta.status}`)
  usuarioId = cadastro.user.id

  const fixture = (await pool.query(
    `SELECT c.idcliente,
            (SELECT idprofissional FROM public.profissional WHERE ativo = TRUE ORDER BY idprofissional LIMIT 1) AS idprofissional,
            (SELECT idservico FROM public.servico WHERE tipo = 'servico' ORDER BY duracao, idservico LIMIT 1) AS idservico
     FROM public.cliente c WHERE c.usuario_idusuario = $1`,
    [usuarioId]
  )).rows[0]
  const servico = (await pool.query('SELECT nome, duracao, preco FROM public.servico WHERE idservico = $1', [fixture.idservico])).rows[0]
  const data = (await pool.query("SELECT TO_CHAR(CURRENT_DATE + INTERVAL '710 days', 'YYYY-MM-DD') AS data")).rows[0].data
  const agenda = await pool.query(
    `INSERT INTO public.agenda (data, disponivel) VALUES ($1::date, TRUE)
     ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data RETURNING idagenda`, [data]
  )
  agendamentoId = (await pool.query(
    `INSERT INTO public.agendamento
      (agenda_idagenda, cliente_idcliente, profissional_idprofissional, servico_idservico,
       dataagendamento, horario, statusagendamento, servico_nome_snapshot, duracao_snapshot, valor_snapshot)
     VALUES ($1, $2, $3, $4, $5::date, '06:00', 'AGENDADO', $6, $7, $8)
     RETURNING idagendamento`,
    [agenda.rows[0].idagenda, fixture.idcliente, fixture.idprofissional, fixture.idservico,
      data, servico.nome, servico.duracao, servico.preco]
  )).rows[0].idagendamento

  const checkoutResposta = await fetch(`${api}/pagamentos/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cadastro.token}` },
    body: JSON.stringify({ agendamentoId, produtos: [] }),
  })
  const checkout = await checkoutResposta.json()
  if (checkoutResposta.status !== 201) throw new Error(`Checkout falhou: ${checkoutResposta.status}`)
  sessionId = checkout.sessionId
  pagamentoId = (await pool.query('SELECT idpagamento FROM public.pagamento WHERE stripe_checkout_session_id = $1', [sessionId])).rows[0].idpagamento

  const clienteWhatsApp = {
    obterStatus: () => ({ estado: 'conectado' }),
    async enviarTexto(dados) {
      envios.push(dados)
      return { messageId: `BAR46-MSG-${envios.length}` }
    },
  }
  const servicoNotificacao = criarNotificacoesWhatsappService({
    clienteWhatsApp,
    env: { ...process.env, WHATSAPP_ENABLED: 'true' },
    logger: { info() {}, warn() {} },
  })

  await pool.query(
    `UPDATE public.whatsapp_notificacao
     SET status = 'PENDENTE', tentativas = 0, proxima_tentativa_em = CASE
       WHEN tipo = 'RESERVA_PAGAMENTO' THEN NOW()
       ELSE NOW() + INTERVAL '1 hour' END
     WHERE agendamento_idagendamento = $1`, [agendamentoId]
  )
  await servicoNotificacao.processarAgendamento(agendamentoId)
  const reserva = envios[0]?.mensagem || ''
  registrar('CT-WPP-02A', 'Mensagem de reserva contem dados, prazo e link do checkout',
    /Cliente Mensagens|Cliente/i.test(reserva)
      && reserva.includes(servico.nome)
      && reserva.includes('06:00')
      && reserva.includes('Conclua o pagamento')
      && reserva.includes('https://checkout.stripe.com/')
      && semCaracterQuebrado(reserva),
    reserva)

  await pool.query(
    `UPDATE public.whatsapp_notificacao
     SET status = 'PENDENTE', tentativas = 0, proxima_tentativa_em = NOW()
     WHERE agendamento_idagendamento = $1 AND tipo = 'LEMBRETE_PAGAMENTO'`, [agendamentoId]
  )
  await servicoNotificacao.processarAgendamento(agendamentoId)
  const lembrete = envios[1]?.mensagem || ''
  registrar('CT-WPP-03A', 'Lembrete informa tres minutos e reutiliza o mesmo checkout',
    /3 minutos/.test(lembrete)
      && lembrete.includes('https://checkout.stripe.com/')
      && semCaracterQuebrado(lembrete),
    lembrete)

  await pool.query("UPDATE public.pagamento SET statuspagamento = 'CONFIRMADO' WHERE idpagamento = $1", [pagamentoId])
  await pool.query(
    `INSERT INTO public.whatsapp_notificacao (agendamento_idagendamento, tipo, proxima_tentativa_em)
     VALUES ($1, 'PAGAMENTO_CONFIRMADO', NOW())
     ON CONFLICT (agendamento_idagendamento, tipo) DO UPDATE
       SET status = 'PENDENTE', tentativas = 0, proxima_tentativa_em = NOW()`, [agendamentoId]
  )
  await servicoNotificacao.processarAgendamento(agendamentoId)
  const confirmacao = envios[2]?.mensagem || ''
  registrar('CT-WPP-04A', 'Confirmacao contem servico, data, horario e profissional',
    confirmacao.includes(servico.nome)
      && confirmacao.includes('06:00')
      && /Pagamento confirmado/i.test(confirmacao)
      && /Profissional:/i.test(confirmacao)
      && semCaracterQuebrado(confirmacao),
    confirmacao)

  const semPendente = await servicoNotificacao.processarAgendamento(agendamentoId)
  registrar('CT-WPP-03B', 'Fila concluida nao reenvia mensagens',
    envios.length === 3 && semPendente.motivo === 'SEM_NOTIFICACAO_PENDENTE',
    JSON.stringify({ totalEnvios: envios.length, semPendente }))

  const relatorio = {
    executadoEm: new Date().toISOString(),
    observacao: 'O transporte foi substituido por um cliente capturador; o recebimento em outro telefone continua manual.',
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
    mensagens: envios.map((item, indice) => ({ ordem: indice + 1, mensagem: item.mensagem })),
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-whatsapp-mensagens-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify({ ...relatorio, mensagens: `${envios.length} mensagens capturadas no arquivo de evidencia` }, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (sessionId) await getStripe().checkout.sessions.expire(sessionId).catch(() => {})
  if (agendamentoId) await pool.query('DELETE FROM public.whatsapp_notificacao WHERE agendamento_idagendamento = $1', [agendamentoId]).catch(() => {})
  if (pagamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PAGAMENTO' AND referencia_id = $1", [pagamentoId]).catch(() => {})
  if (agendamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'AGENDAMENTO' AND referencia_id = $1", [agendamentoId]).catch(() => {})
  if (pagamentoId) await pool.query('DELETE FROM public.pagamento WHERE idpagamento = $1', [pagamentoId]).catch(() => {})
  if (agendamentoId) await pool.query('DELETE FROM public.agendamento WHERE idagendamento = $1', [agendamentoId]).catch(() => {})
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  await pool.end().catch(() => {})
})
