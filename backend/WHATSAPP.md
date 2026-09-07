# Integração com WhatsApp via Baileys

O backend usa o Baileys para conectar uma conta do WhatsApp Web e enviar a
confirmação de agendamento após a confirmação do pagamento.

## Configuração

Defina no arquivo `.env` do backend:

```env
WHATSAPP_ENABLED=true
WHATSAPP_TIMEOUT_MS=10000
WHATSAPP_RECONNECT_MS=5000
WHATSAPP_NOTIFICATION_INTERVAL_MS=30000
WHATSAPP_SESSION_DIR=./.whatsapp-session
WHATSAPP_TEST_ENDPOINT_ENABLED=true
WHATSAPP_TEST_RECIPIENT=5511999999999
WHATSAPP_TEST_MESSAGE=Teste de confirmação de agendamento — O Rei da Navalha.
```

O telefone precisa conter `55`, DDD e número, somente com dígitos. As antigas
variáveis da API da Meta não são usadas pelo Baileys.

## Primeira conexão

1. Execute `npm run dev` na pasta `backend`.
2. No terminal, aguarde a exibição do QR Code.
3. No celular, abra WhatsApp > Aparelhos conectados > Conectar aparelho.
4. Escaneie o QR Code.
5. Aguarde a mensagem `WhatsApp conectado pelo Baileys.`.

As credenciais ficam em `backend/.whatsapp-session` quando o servidor é iniciado
dentro da pasta `backend`. Essa pasta é privada, está no `.gitignore` e não deve
ser enviada para o GitHub.

Em uma hospedagem, configure `WHATSAPP_SESSION_DIR` para um diretório persistente.
Se a plataforma apagar esse diretório a cada deploy, será necessário ler um novo
QR Code. Nunca coloque os arquivos da sessão em variável de ambiente, banco de
dados público ou repositório Git.

Se aparecer o código de desconexão `401`, encerre o backend, remova somente a
pasta `backend/.whatsapp-session`, inicie novamente e leia o novo QR Code.

## Endpoints administrativos de teste

As rotas exigem um JWT de administrador:

```text
GET  /api/whatsapp/status
POST /api/whatsapp/teste
```

No teste de envio, use `Content-Type: application/json` e um objeto vazio:

```json
{}
```

O endpoint de teste usa exclusivamente `WHATSAPP_TEST_RECIPIENT` e
`WHATSAPP_TEST_MESSAGE`. As notificações reais usam o telefone cadastrado pelo
cliente.

## Confirmação automática de pagamento

Execute a migração `019_notificacoes_whatsapp.sql` no Neon antes de testar.
Quando o pagamento muda para `CONFIRMADO`, um trigger registra uma notificação
pendente na mesma transação. O backend tenta enviá-la imediatamente e também
verifica pendências no intervalo definido por
`WHATSAPP_NOTIFICATION_INTERVAL_MS`.

A mensagem contém o primeiro nome do cliente, serviço, data, horário e
profissional. Cada agendamento possui no máximo uma notificação do tipo
`PAGAMENTO_CONFIRMADO`, evitando mensagens duplicadas.

O pagamento permanece confirmado se o WhatsApp estiver temporariamente
desconectado. A notificação é reagendada com espera progressiva, até o limite de
cinco tentativas.

Se o processo for encerrado durante um envio, registros que permanecerem em
`PROCESSANDO` por mais de dois minutos retornam automaticamente para a fila na
próxima inicialização. `SIGINT` e `SIGTERM` também encerram a fila, o socket do
WhatsApp e o pool do banco de maneira controlada.

## Consulta da fila

```sql
SELECT idnotificacao,
       agendamento_idagendamento,
       status,
       tentativas,
       ultimo_erro,
       enviado_em
FROM public.whatsapp_notificacao
ORDER BY idnotificacao DESC
LIMIT 20;
```

Para os testes do TCC, prefira um número secundário e envie mensagens apenas a
destinatários que autorizaram o contato. O Baileys é uma integração não oficial
baseada no WhatsApp Web; para produção comercial, prefira a API oficial do
WhatsApp Business.
