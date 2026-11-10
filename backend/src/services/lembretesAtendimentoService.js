const PREFIXO = 'LEMBRETE_ATENDIMENTO_'

function tipoLembrete(inicio, janela) {
  return `${PREFIXO}${Math.floor(new Date(inicio).getTime() / 1000)}_${janela}H`
}

function janelaDoLembrete(item) {
  const tipo = String(item.tipo || '')
  if (tipo.endsWith('_24H')) return 24
  if (tipo.endsWith('_12H')) return 12

  const inicio = new Date(item.inicio_atendimento).getTime()
  const reserva = new Date(item.lembrete_reservado_em).getTime()
  return reserva <= inicio - 24 * 3600000 ? 24 : 12
}

// One-hour dispatch windows tolerate short outages without sending late reminders.
async function enfileirarLembretes(db) {
  return db.query(`
    INSERT INTO public.whatsapp_notificacao (agendamento_idagendamento, tipo, lembrete_inicio)
    SELECT a.idagendamento,
           '${PREFIXO}' || EXTRACT(EPOCH FROM h.inicio)::bigint || '_' || janela.horas || 'H',
           h.inicio
    FROM public.agendamento a
    JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
    CROSS JOIN LATERAL (SELECT (a.dataagendamento + a.horario) AT TIME ZONE 'America/Sao_Paulo' AS inicio) h
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN a.lembrete_reservado_em <= h.inicio - INTERVAL '24 hours'
          AND h.inicio > NOW() + INTERVAL '23 hours'
          AND h.inicio <= NOW() + INTERVAL '24 hours' THEN 24
        WHEN h.inicio > NOW() + INTERVAL '11 hours'
          AND h.inicio <= NOW() + INTERVAL '12 hours' THEN 12
        ELSE NULL
      END AS horas
    ) janela
    WHERE a.statusagendamento = 'AGENDADO' AND c.receber_lembretes_whatsapp
      AND a.lembrete_reservado_em <= NOW() - INTERVAL '2 hours'
      AND janela.horas IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.pagamento pg WHERE pg.agendamento_idagendamento = a.idagendamento
        AND (pg.statuspagamento = 'CONFIRMADO' OR (pg.metodo = 'DINHEIRO' AND pg.statuspagamento = 'PENDENTE')))
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_notificacao n
        WHERE n.agendamento_idagendamento = a.idagendamento
          AND n.tipo LIKE '${PREFIXO}%'
          AND n.lembrete_inicio = h.inicio
          AND n.enviado_em IS NOT NULL
          AND COALESCE(n.message_id, '') <> 'IGNORADA'
      )
    ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING
  `)
}

function lembreteValido(item, agora = Date.now()) {
  const inicio = new Date(item.inicio_atendimento).getTime()
  const restante = inicio - agora
  const horas = 3600000
  const janela = janelaDoLembrete(item)
  return item.receber_lembretes_whatsapp === true && item.statusagendamento === 'AGENDADO'
    && inicio === new Date(item.lembrete_inicio).getTime()
    && restante > (janela - 1) * horas && restante <= janela * horas
    && (item.statuspagamento === 'CONFIRMADO' || (item.metodo === 'DINHEIRO' && item.statuspagamento === 'PENDENTE'))
}

function mensagemLembreteAtendimento(item, frontendUrl) {
  const limpar = (v) => String(v || '').replace(/[\u0000-\u001f\u007f*~_`]/g, ' ').trim().slice(0, 120)
  const produtos = String(item.produtos || '')
    .replace(/[\u0000-\u001f\u007f*~_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
  return ['💈 *O Rei da Navalha — Lembrete de atendimento*', '',
    `Olá, *${limpar(item.cliente).split(' ')[0]}*! ✂️ Seu horário está chegando!`, '',
    `📅 *Data:* ${limpar(item.data)}`, `🕒 *Horário:* ${limpar(item.horario)} (horário de Brasília)`,
    `💇 *Serviço:* ${limpar(item.servico)}`, `👤 *Profissional:* ${limpar(item.profissional)}`,
    ...(produtos ? [`🛍️ *Produtos para retirada:* ${produtos}`] : []), '',
    'Precisa alterar ou cancelar? Consulte seus agendamentos:',
    `🔗 ${frontendUrl.replace(/\/$/, '')}/historico`, '', 'Esperamos você! 👑'].join('\n')
}
module.exports = {
  PREFIXO,
  enfileirarLembretes,
  janelaDoLembrete,
  lembreteValido,
  mensagemLembreteAtendimento,
  tipoLembrete,
}
