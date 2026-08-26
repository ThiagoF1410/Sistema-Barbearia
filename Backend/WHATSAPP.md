# WhatsApp com Baileys

Esta integração usa o Baileys para conectar o backend a uma conta do WhatsApp por meio do protocolo do WhatsApp Web. Ela é adequada para demonstração e homologação do TCC, mas não é uma API oficial da Meta e não deve ser usada para disparos em massa.

## Configuração

No arquivo `.env` do backend, use:

```env
WHATSAPP_ENABLED=true
WHATSAPP_TIMEOUT_MS=10000
WHATSAPP_RECONNECT_MS=5000
WHATSAPP_NOTIFICATION_INTERVAL_MS=30000
WHATSAPP_TEST_ENDPOINT_ENABLED=true
WHATSAPP_TEST_RECIPIENT=5511999999999
WHATSAPP_TEST_MESSAGE=Teste de confirmação de agendamento — O Rei da Navalha.
```

O telefone precisa conter `55`, DDD e número, somente com dígitos. As antigas variáveis `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_GRAPH_API_VERSION` não são mais usadas.

## Primeira conexão

1. Execute `npm run dev` dentro de `backend`.
2. Aguarde o QR Code aparecer no terminal.
3. No celular, abra WhatsApp > Aparelhos conectados > Conectar um aparelho.
4. Leia o QR Code do terminal.
5. A mensagem `WhatsApp conectado pelo Baileys.` confirma a conexão.

As credenciais da sessão ficam em `backend/.whatsapp-session`. Essa pasta está ignorada pelo Git e nunca deve ser publicada, compartilhada ou adicionada ao repositório.

## Testes administrativos

Com um JWT de administrador:

```http
GET /api/whatsapp/status
Authorization: Bearer SEU_TOKEN
```

O estado esperado depois da leitura do QR Code é:

```json
{
  "estado": "conectado",
  "qrPendente": false
}
```

Para enviar a mensagem de teste:

```http
POST /api/whatsapp/teste
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{}
```

## Sessão encerrada

Se o status for `sessao_encerrada`, pare o backend, apague somente a pasta `backend/.whatsapp-session`, inicie novamente e leia o novo QR Code. Isso será necessário quando o aparelho for desconectado manualmente no WhatsApp.

Para os testes do TCC, prefira um número secundário e envie mensagens apenas a destinatários que autorizaram o contato.

## Confirmação automática (BAR-36)

Execute a migração `019_notificacoes_whatsapp.sql` no Neon antes de testar. Quando o pagamento muda para `CONFIRMADO`, um trigger registra uma notificação pendente na mesma transação. O backend tenta enviá-la imediatamente e também verifica pendências a cada `WHATSAPP_NOTIFICATION_INTERVAL_MS`.

O pagamento permanece confirmado mesmo se o WhatsApp estiver temporariamente desconectado. A notificação fica registrada para novas tentativas, com limite de cinco, e a restrição única por agendamento impede mensagens duplicadas.

## Conteúdo da confirmação (BAR-38)

A confirmação usa o nome do serviço preservado no momento do agendamento e inclui data, horário e profissional. Exemplo:

```text
Olá, Thiago!

Pagamento confirmado. Seu horário está reservado.

Serviço: Combo Degradê
Data: 25/08/2026
Horário: 10:30
Profissional: Lucas Barbeiro

O Rei da Navalha
```

Os campos vindos do banco são sanitizados e limitados antes do envio. Notificações que já estão como `ENVIADO` não são reenviadas ao atualizar o sistema; valide o novo conteúdo com um pagamento novo.
