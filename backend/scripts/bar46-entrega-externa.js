require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { obterClienteWhatsApp } = require('../src/services/whatsappService')
const { sendPasswordResetEmail } = require('../src/services/emailService')

const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/entrega-externa')
const resultados = []

function registrar(id, canal, estado, detalhe = '') {
  resultados.push({ id, canal, estado, detalhe })
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function aguardarWhatsApp(cliente) {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    const status = cliente.obterStatus()
    if (status.estado === 'conectado') return true
    await esperar(500)
  }
  return false
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const destinatario = process.env.WHATSAPP_TEST_RECIPIENT?.trim()
  const email = process.env.EMAIL_USER?.trim()
  const cliente = obterClienteWhatsApp()

  if (!/^55[1-9]\d\d{8,9}$/.test(destinatario || '')) {
    registrar('CT-WPP-EXT-01', 'WhatsApp', 'BLOQUEADO', 'Destinatário de teste não configurado.')
  } else {
    await cliente.iniciar()
    if (!(await aguardarWhatsApp(cliente))) {
      registrar('CT-WPP-EXT-01', 'WhatsApp', 'BLOQUEADO', 'Sessão não conectou dentro do prazo.')
    } else {
      const mensagens = [
        {
          id: 'CT-WPP-02',
          texto: ['✂️ *O Rei da Navalha*', '', '🧪 *Teste BAR-46 — Reserva aguardando pagamento*', '', 'Sua reserva foi criada e aguarda a confirmação do pagamento.', '⏳ Prazo exibido: 10 minutos.', '', '_Mensagem de teste; nenhuma ação é necessária._'].join('\n'),
        },
        {
          id: 'CT-WPP-03',
          texto: ['⏰ *O Rei da Navalha*', '', '🧪 *Teste BAR-46 — Lembrete de pagamento*', '', 'Restam aproximadamente *3 minutos* para concluir o pagamento.', '', '_Mensagem de teste; nenhuma ação é necessária._'].join('\n'),
        },
        {
          id: 'CT-WPP-04',
          texto: ['✅ *O Rei da Navalha*', '', '🧪 *Teste BAR-46 — Pagamento confirmado*', '', 'Seu pagamento foi confirmado e o horário está reservado com sucesso.', '', '_Mensagem de teste; nenhuma ação é necessária._'].join('\n'),
        },
      ]

      for (const mensagem of mensagens) {
        try {
          const envio = await cliente.enviarTexto({ telefone: destinatario, mensagem: mensagem.texto })
          registrar(mensagem.id, 'WhatsApp', 'ENVIADO_AGUARDANDO_CONFIRMACAO', `messageId registrado: ${Boolean(envio.messageId)}`)
        } catch (erro) {
          registrar(mensagem.id, 'WhatsApp', 'REPROVADO', erro.code || 'WHATSAPP_SEND_ERROR')
        }
        await esperar(750)
      }
    }
  }

  if (!email || !process.env.EMAIL_PASS) {
    registrar('CT-AUTH-09', 'E-mail', 'BLOQUEADO', 'Credenciais de e-mail não configuradas.')
  } else {
    try {
      await sendPasswordResetEmail(email, 'bar46-validacao-de-entrega-nao-utilizar')
      registrar('CT-AUTH-09', 'E-mail', 'ENVIADO_AGUARDANDO_CONFIRMACAO', 'SMTP aceitou a mensagem; confirmar recebimento na caixa postal.')
    } catch (erro) {
      registrar('CT-AUTH-09', 'E-mail', 'REPROVADO', erro.code || erro.message)
    }
  }

  const relatorio = {
    executadoEm: new Date().toISOString(),
    aviso: 'Destinatários e segredos foram omitidos. O link do e-mail é apenas uma evidência de entrega e não deve ser utilizado.',
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-entrega-externa-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(relatorio, null, 2))
  if (resultados.some((item) => item.estado === 'REPROVADO')) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha na validação externa.', detalhe: erro.code || erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    await obterClienteWhatsApp().encerrar().catch(() => {})
  })
