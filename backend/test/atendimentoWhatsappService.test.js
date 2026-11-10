const test = require('node:test')
const assert = require('node:assert/strict')
const {
  criarAtendimentoWhatsappService,
  identificarAssunto,
} = require('../src/services/atendimentoWhatsappService')
const { criarClienteWhatsApp } = require('../src/services/whatsappService')

const loggerSilencioso = { info() {}, warn() {} }

test('identifica somente assuntos permitidos do atendimento', () => {
  assert.equal(identificarAssunto('[ATENDIMENTO:REEMBOLSO]').codigo, 'REEMBOLSO')
  assert.equal(identificarAssunto('Protocolo: ORN-DUVIDA_PEDIDO').codigo, 'DUVIDA_PEDIDO')
  assert.equal(identificarAssunto('🏷️ *Tipo de atendimento:* Reagendamento').codigo, 'ALTERAR_AGENDAMENTO')
  assert.equal(identificarAssunto('🏷️ *Tipo de atendimento:* Outro assunto').codigo, 'OUTRO')
  assert.equal(identificarAssunto('texto comum'), null)
  assert.equal(identificarAssunto('[ATENDIMENTO:ADMIN]'), null)
})

test('registra notificação administrativa após receber a mensagem', async () => {
  const consultas = []
  const db = {
    async query(sql, valores) {
      consultas.push({ sql, valores })
      if (sql.includes('FROM public.cliente')) {
        return { rows: [{ idcliente: 8, nome: 'Matheus Francisco' }] }
      }
      return { rows: [] }
    },
  }
  const servico = criarAtendimentoWhatsappService({ db, logger: loggerSilencioso })

  const resultado = await servico.processarMensagem({
    messageId: 'WA-ABC-123',
    telefone: '5518997862274',
    texto: 'Olá\n[ATENDIMENTO:ALTERAR_AGENDAMENTO]',
  })

  assert.deepEqual(resultado, {
    processada: true,
    assunto: 'ALTERAR_AGENDAMENTO',
    clienteId: 8,
  })
  assert.deepEqual(consultas[1].valores, [
    'ATENDIMENTO_WHATSAPP',
    'Alteração de agendamento',
    'Matheus Francisco entrou em contato pelo WhatsApp: Alteração de agendamento.',
    '/admin/agendamentos',
    'CLIENTE',
    8,
    'ATENDIMENTO_WHATSAPP:WA-ABC-123',
  ])
})

test('ignora mensagens que não pertencem ao fluxo do site', async () => {
  let consultou = false
  const servico = criarAtendimentoWhatsappService({
    db: { async query() { consultou = true } },
    logger: loggerSilencioso,
  })
  const resultado = await servico.processarMensagem({
    messageId: 'WA-1', telefone: '5518997862274', texto: 'Bom dia',
  })
  assert.deepEqual(resultado, { processada: false, motivo: 'MENSAGEM_FORA_DO_FLUXO' })
  assert.equal(consultou, false)
})

test('Baileys encaminha apenas mensagens novas recebidas de terceiros', async () => {
  const handlers = {}
  const socket = {
    user: { phoneNumber: '5511999990000@s.whatsapp.net' },
    ev: { on(evento, handler) { handlers[evento] = handler } },
    async sendMessage() { return { key: { id: 'ENVIO-1' } } },
    end() {},
  }
  const cliente = criarClienteWhatsApp({
    env: {
      WHATSAPP_ENABLED: 'true',
      WHATSAPP_TIMEOUT_MS: '5000',
      WHATSAPP_RECONNECT_MS: '5000',
    },
    logger: loggerSilencioso,
    carregarDependencias: async () => ({
      makeWASocket: () => socket,
      useMultiFileAuthState: async () => ({ state: {}, saveCreds() {} }),
      DisconnectReason: { loggedOut: 401 },
      Browsers: { ubuntu: () => ['Teste', 'Chrome', '1.0'] },
      renderizarQr() {},
    }),
  })
  const recebidas = []
  cliente.registrarManipuladorMensagens((mensagem) => recebidas.push(mensagem))
  await cliente.iniciar()
  handlers['connection.update']({ connection: 'open' })
  assert.equal(cliente.obterContato(), '5511999990000')

  handlers['messages.upsert']({
    type: 'notify',
    messages: [{
      key: { id: 'MSG-1', remoteJid: '5511988887777@s.whatsapp.net', fromMe: false },
      message: { conversation: ' [ATENDIMENTO:OUTRO] ' },
    }],
  })
  handlers['messages.upsert']({
    type: 'notify',
    messages: [{
      key: { id: 'MSG-2', remoteJid: '5511988887777@s.whatsapp.net', fromMe: true },
      message: { conversation: '[ATENDIMENTO:OUTRO]' },
    }],
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(recebidas, [{
    messageId: 'MSG-1',
    telefone: '5511988887777',
    texto: '[ATENDIMENTO:OUTRO]',
  }])
  await cliente.encerrar()
})
