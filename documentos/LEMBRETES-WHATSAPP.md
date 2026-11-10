# Lembretes de atendimento

Aplicar `backend/migrations/030_lembretes_atendimento.sql` antes da ativação.
Configurar `WHATSAPP_REMINDERS_ENABLED=true`, manter `WHATSAPP_ENABLED=true` e definir `FRONTEND_URL` acessível ao cliente. Reiniciar backend após configurar.

O cliente autoriza os lembretes em Meu perfil. O padrão é desativado, inclusive para cadastros existentes.

Um lembrete por agendamento e instante de atendimento: 24h antes para reservas antigas, 12h antes para reservas feitas com menos de 24h. Reservas muito próximas não recebem lembrete. Janela de envio de uma hora, com intervalo mínimo de duas horas desde a reserva e mensagens já enviadas.

Somente AGENDADO com pagamento confirmado ou dinheiro pendente. Antes de enviar, conferir novamente consentimento, data e situação. Remarcação invalida notificações antigas e reinicia a antecedência. Horários são calculados em America/Sao_Paulo.

A fila existente mantém reivindicação concorrente, cinco tentativas e recuperação após reinício. A unicidade impede reenfileiramento do mesmo horário; como em outros envios Baileys, falha após entregar e antes de registrar no banco pode ocasionar repetição. Backend e WhatsApp precisam estar conectados. Interrupções maiores que a janela não geram lembretes atrasados.

Não executar teste de envio com números reais sem autorização. Testes unitários usam dados fictícios e não enviam mensagens.
