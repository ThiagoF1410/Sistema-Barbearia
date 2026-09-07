const test = require('node:test')
const assert = require('node:assert/strict')
const {
  campoMensagem,
  criarNotificacoesWhatsappService,
  mensagemConfirmacao,
} = require('../src/services/notificacoesWhatsappService')

const loggerSilencioso = { info() {}, warn() {} }

function criarDbFake({ semPendente = false } = {}) {
  const consultas = []
  return {
    consultas,
    async query(sql, parametros) {
      consultas.push({ sql, parametros })
      if (sql.includes("SET status = 'PROCESSANDO'")) {
        return { rows: semPendente ? [] : [{ idnotificacao: 41 }] }
      }
      if (sql.includes('SELECT c.telefone, u.nome AS cliente')) {
        return { rows: [{
          telefone: '11999991234',
          cliente: 'Thiago Francisco',
          servico: 'Combo Degradê',
          data: '25/08/2026',
          horario: '10:30',
          profissional: 'Lucas Barbeiro',
        }] }
      }
      if (sql.includes('SELECT agendamento_idagendamento')) return { rows: [] }
      return { rows: [] }
    },
  }
}

function clienteFake({ estado = 'conectado', falhar = false } = {}) {
  const envios = []
  return {
    envios,
    obterStatus: () => ({ estado, qrPendente: false }),
    async enviarTexto(dados) {
      envios.push(dados)
      if (falhar) {
        const err = new Error('detalhe que não deve ser persistido')
        err.code = 'WHATSAPP_SEND_ERROR'
        throw err
      }
      return { messageId: 'MSG-123' }
    },
  }
}

test('monta mensagem da BAR-38 com os dados completos do agendamento', () => {
  assert.equal(
    mensagemConfirmacao({
      cliente: 'Thiago Francisco',
      servico: 'Combo Degradê',
      data: '25/08/2026',
      horario: '10:30',
      profissional: 'Lucas Barbeiro',
    }),
    [
      '✦ *O Rei da Navalha* ✦',
      '',
      'Olá, *Thiago*! 💈',
      '',
      '✅ *Pagamento confirmado!*',
      'Seu horário está reservado com sucesso.',
      '',
      '━━━━━━━━━━━━━━',
      '✂️ *Serviço:* Combo Degradê',
      '📅 *Data:* 25/08/2026',
      '🕒 *Horário:* 10:30',
      '👤 *Profissional:* Lucas Barbeiro',
      '━━━━━━━━━━━━━━',
      '',
      'Obrigado pela preferência. Aguardamos você! 👑',
    ].join('\n')
  )
})

test('remove controles e limita campos antes de montar a mensagem', () => {
  assert.equal(campoMensagem(' Lucas\n\tBarbeiro ', 'Profissional'), 'Lucas Barbeiro')
  assert.equal(campoMensagem('abcdefgh', 'x', 5), 'abcde')
  assert.equal(campoMensagem('', 'não informado'), 'não informado')
})

test('reivindica e envia uma notificação pendente uma única vez', async () => {
  const db = criarDbFake()
  const whatsapp = clienteFake()
  const service = criarNotificacoesWhatsappService({
    db,
    clienteWhatsApp: whatsapp,
    env: { WHATSAPP_ENABLED: 'true' },
    logger: loggerSilencioso,
  })

  const resultado = await service.processarAgendamento(9)

  assert.deepEqual(resultado, { processada: true, enviada: true, idnotificacao: 41 })
  assert.deepEqual(whatsapp.envios, [{
    telefone: '11999991234',
    mensagem: [
      '✦ *O Rei da Navalha* ✦',
      '',
      'Olá, *Thiago*! 💈',
      '',
      '✅ *Pagamento confirmado!*',
      'Seu horário está reservado com sucesso.',
      '',
      '━━━━━━━━━━━━━━',
      '✂️ *Serviço:* Combo Degradê',
      '📅 *Data:* 25/08/2026',
      '🕒 *Horário:* 10:30',
      '👤 *Profissional:* Lucas Barbeiro',
      '━━━━━━━━━━━━━━',
      '',
      'Obrigado pela preferência. Aguardamos você! 👑',
    ].join('\n'),
  }])
  const conclusao = db.consultas.find((item) => item.sql.includes("SET status = 'ENVIADO'"))
  assert.deepEqual(conclusao.parametros, [41, 'MSG-123'])
})

test('não consulta a fila enquanto o WhatsApp estiver desconectado', async () => {
  const db = criarDbFake()
  const service = criarNotificacoesWhatsappService({
    db,
    clienteWhatsApp: clienteFake({ estado: 'reconectando' }),
    env: { WHATSAPP_ENABLED: 'true' },
    logger: loggerSilencioso,
  })

  assert.deepEqual(await service.processarAgendamento(9), {
    processada: false,
    motivo: 'WHATSAPP_INDISPONIVEL',
  })
  assert.equal(db.consultas.length, 0)
})

test('registra somente código seguro e reagenda quando o envio falha', async () => {
  const db = criarDbFake()
  const service = criarNotificacoesWhatsappService({
    db,
    clienteWhatsApp: clienteFake({ falhar: true }),
    env: { WHATSAPP_ENABLED: 'true' },
    logger: loggerSilencioso,
  })

  const resultado = await service.processarAgendamento(9)

  assert.deepEqual(resultado, {
    processada: true,
    enviada: false,
    idnotificacao: 41,
    codigo: 'WHATSAPP_SEND_ERROR',
  })
  const falha = db.consultas.find((item) => item.sql.includes("SET status = 'FALHOU'"))
  assert.deepEqual(falha.parametros, [41, 'WHATSAPP_SEND_ERROR'])
  assert.equal(JSON.stringify(db.consultas).includes('detalhe que não deve ser persistido'), false)
})

test('não reenvia quando não existe notificação pendente', async () => {
  const db = criarDbFake({ semPendente: true })
  const whatsapp = clienteFake()
  const service = criarNotificacoesWhatsappService({
    db,
    clienteWhatsApp: whatsapp,
    env: { WHATSAPP_ENABLED: 'true' },
    logger: loggerSilencioso,
  })

  assert.deepEqual(await service.processarAgendamento(9), {
    processada: false,
    motivo: 'SEM_NOTIFICACAO_PENDENTE',
  })
  assert.equal(whatsapp.envios.length, 0)
})

test('recupera notificações abandonadas em processamento após reinício', async () => {
  let sqlExecutado = ''
  const avisos = []
  const service = criarNotificacoesWhatsappService({
    db: { async query(sql) { sqlExecutado = sql; return { rows: [], rowCount: 2 } } },
    clienteWhatsApp: clienteFake(),
    env: { WHATSAPP_ENABLED: 'true' },
    logger: { info() {}, warn(mensagem, detalhes) { avisos.push({ mensagem, detalhes }) } },
  })

  assert.equal(await service.recuperarInterrompidas(), 2)
  assert.match(sqlExecutado, /status = 'PROCESSANDO'/)
  assert.match(sqlExecutado, /INTERVAL '2 minutes'/)
  assert.equal(avisos[0].detalhes.quantidade, 2)
})
