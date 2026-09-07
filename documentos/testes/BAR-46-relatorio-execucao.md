# BAR-46 — Relatório de execução

**Situação: CONCLUÍDA em 04/09/2026.**

## Rodada 3 — 04/09/2026 — correção e regressão

Os cinco bugs encontrados na rodada inicial foram corrigidos e submetidos a
reteste direcionado. Foram executadas seis verificações, pois o aviso de sessão
expirada também foi validado quanto ao consumo único.

| Verificação | Resultado |
|---|---|
| BUG-001 — limite na rota alternativa de cadastro | APROVADO |
| BUG-002 — `.env.example` seguro e completo | APROVADO |
| BUG-003 — migrations 019 a 026 documentadas | APROVADO |
| BUG-004 — foco programático sem moldura indevida | APROVADO |
| BUG-005 — aviso formal de sessão expirada | APROVADO |
| BUG-005B — aviso exibido uma única vez | APROVADO |

Resultado da rodada: **6/6 aprovadas, sem reprovação**. A suíte automatizada do
backend permaneceu em **66/66**, e o lint e o build de produção do frontend
foram aprovados. O aviso do chunk assíncrono do ExcelJS permanece registrado
como `MEL-001`, melhoria não bloqueante de desempenho.

A evidência estruturada está em
`documentos/testes/evidencias/correcoes-bugs/bar46-bugs-reteste-resultados.json`.

## Rodada 2 — 04/09/2026 — entregas externas

Os quatro disparos externos que ainda dependiam de transporte real foram
executados sem alterar o `.env`:

| Caso | Resultado técnico | Confirmação humana |
|---|---|---|
| CT-WPP-02 — reserva aguardando pagamento | Baileys aceitou e retornou `messageId` | Recebimento confirmado pelo usuário |
| CT-WPP-03 — lembrete de três minutos | Baileys aceitou e retornou `messageId` | Recebimento confirmado pelo usuário |
| CT-WPP-04 — pagamento confirmado | Baileys aceitou e retornou `messageId` | Recebimento confirmado pelo usuário |
| CT-AUTH-09 — e-mail de recuperação | Servidor SMTP aceitou a mensagem | Recebimento confirmado pelo usuário |

Os destinatários, tokens e segredos foram omitidos da evidência. O e-mail desta
rodada serve apenas para confirmar entrega e seu link não deve ser utilizado.
O resultado seguro está em
`documentos/testes/evidencias/entrega-externa/bar46-entrega-externa-resultados.json`.

O transporte foi comprovado tecnicamente e o usuário confirmou o recebimento
dos quatro disparos em 04/09/2026. Os casos CT-WPP-02, CT-WPP-03, CT-WPP-04,
CT-STRIPE-10 e CT-AUTH-09 foram atualizados para `APROVADO`.

## Rodada 1 - 03/09/2026

### Resumo

| Grupo | Executados | Aprovados | Reprovados | Bloqueados |
|---|---:|---:|---:|---:|
| Testes automatizados do backend | 66 | 66 | 0 | 0 |
| Smoke HTTP de autenticação/cliente | 19 | 19 | 0 | 0 |
| Smoke HTTP administrativo/profissional | 30 | 30 | 0 | 0 |
| Fluxo HTTP de agendamento/cancelamento | 15 | 15 | 0 | 0 |
| Fluxo HTTP de loja/Stripe | 15 | 15 | 0 | 0 |
| Diagnóstico WhatsApp/Baileys | 3 | 2 | 0 | 1 |
| Captura autenticada de rotas no Edge | 25 | 25 | 0 | 0 |
| Revisão visual das capturas | 1 | 0 | 1 | 0 |
| Regras de negócio avançadas e concorrência | 22 | 22 | 0 | 0 |
| Alterações administrativas com restauração | 10 | 10 | 0 | 0 |
| Interações reais no Edge | 13 | 12 | 1 | 0 |
| Navegação no build de produção | 25 | 25 | 0 | 0 |
| Disponibilidade e exceções da agenda | 5 | 5 | 0 | 0 |
| Exportação XLSX anual e mensal | 5 | 5 | 0 | 0 |
| Suporte WhatsApp e notificação administrativa | 3 | 3 | 0 | 0 |
| Wizard completo e proteção contra duplo clique | 7 | 7 | 0 | 0 |
| Recuperação de senha sem entrega do e-mail | 4 | 4 | 0 | 0 |
| Prazo Stripe, lembrete programado e produtos adicionais | 4 | 4 | 0 | 0 |
| Webhook, atualização automática e retorno Stripe | 5 | 5 | 0 | 0 |
| Conteúdo e idempotência das mensagens WhatsApp | 4 | 4 | 0 | 0 |
| Pagamento real com cartão de teste | 1 | 1 | 0 | 0 |
| Checkout em nova aba e contador na aba original | 2 | 2 | 0 | 0 |
| **Total de verificações executadas** | **284** | **281** | **2** | **1** |

### Validações de frontend

| Comando | Resultado | Observação |
|---|---|---|
| `npm run lint` | APROVADO | Nenhum erro do ESLint. |
| `npm run build` | APROVADO | Build concluído em aproximadamente 2,09 s. |

O build apresentou um aviso não bloqueante: o chunk assíncrono do ExcelJS possui aproximadamente 929,58 kB antes de gzip e 256,44 kB após gzip. O restante da aplicação permanece separado em chunks por página.

### Dados de teste criados

| Registro | Identificação | Situação final |
|---|---|---|
| Cliente de autenticação | `bar46.qa.1788411009814@example.com` | Cadastro de teste ativo |
| Cliente de agendamento | `bar46.agendamento.1788411232666@example.com` | Cadastro de teste ativo |
| Agendamento | nº 17 | Cancelado; horário liberado |
| Cliente da loja | `bar46.loja.1788411295141@example.com` | Cadastro de teste ativo |
| Pedido em dinheiro | nº 5 | Cancelado |
| Pedido Stripe | nº 6 | Cancelado e checkout expirado |
| Serviço temporário | Serviço Teste BAR 46 | Removido ao final do teste |

Os registros cancelados foram preservados como evidência de histórico. Antes do deploy final, os dados com prefixo `bar46.` devem ser removidos do banco de homologação ou mantidos em um banco exclusivo de testes.

### Evidência reproduzível

Os seguintes scripts não exibem senhas, JWT ou segredos:

- `backend/scripts/bar46-api-smoke.js`
- `backend/scripts/bar46-role-smoke.js`
- `backend/scripts/bar46-appointment-smoke.js`
- `backend/scripts/bar46-order-smoke.js`
- `backend/scripts/bar46-whatsapp-smoke.js`
- `backend/scripts/bar46-ui-capture.js`
- `backend/scripts/bar46-regras-negocio-smoke.js`
- `backend/scripts/bar46-admin-restauracao-smoke.js`
- `backend/scripts/bar46-ui-interacoes.js`
- `backend/scripts/bar46-disponibilidade-smoke.js`
- `backend/scripts/bar46-xlsx-smoke.js`
- `backend/scripts/bar46-whatsapp-suporte-smoke.js`
- `backend/scripts/bar46-wizard-ui-smoke.js`
- `backend/scripts/bar46-recuperacao-senha-smoke.js`
- `backend/scripts/bar46-stripe-prazo-smoke.js`
- `backend/scripts/bar46-stripe-retorno-smoke.js`
- `backend/scripts/bar46-whatsapp-mensagens-smoke.js`
- `backend/scripts/bar46-stripe-cartao-manual.js`
- `backend/scripts/bar46-checkout-nova-aba-smoke.js`

As 25 capturas e o diagnóstico estruturado da interface estão em
`documentos/testes/evidencias/`. O arquivo `bar46-ui-resultados.json` registra
rota, perfil, largura, overflow, carregamento e erro técnico de cada tela.

### Rodada visual e WhatsApp

- 25/25 rotas autenticadas carregaram no Microsoft Edge sem overflow
  horizontal, mensagem técnica ou estado permanente de carregamento.
- Foram verificadas telas de cliente, administrador e profissional em 1365 px;
  os principais fluxos também foram capturados com viewport móvel real de
  390 px.
- O Baileys respondeu como `conectado` e o link de suporte gerado foi válido.
- O envio controlado pelo endpoint de teste ficou `BLOQUEADO`, pois
  `WHATSAPP_TEST_ENDPOINT_ENABLED=false`. A configuração é segura para uso
  normal e não caracteriza defeito.
- A inspeção humana encontrou a moldura de foco indevida no título da etapa do
  agendamento, registrada como `BUG-004`.

### Regras avançadas validadas

- concorrência real de duas reservas para a mesma vaga: uma resposta HTTP 201
  e uma HTTP 409;
- bloqueio de cancelamento com menos de duas horas;
- bloqueio de conclusão antes do término e conclusão posterior válida;
- preservação de serviço com histórico vinculado;
- criação, edição, desativação e revogação da sessão de profissional;
- solicitação de folga cancelada pelo profissional;
- aprovação e recusa administrativa com criação da indisponibilidade somente
  após aprovação;
- criação, bloqueio, liberação e remoção de data especial.

Os registros dessa rodada foram identificados pelo prefixo `bar46.regras` e
removidos automaticamente ao final, incluindo usuários, agenda, solicitações,
indisponibilidades e serviços temporários.

### Interações de interface validadas

- redirecionamento de cliente ao tentar acessar rota administrativa;
- rota inexistente com retorno seguro;
- item ativo único no menu administrativo;
- calendário em primeiro plano, contido no viewport móvel e com bloqueio do
  conteúdo de fundo;
- abas Produtos/Meus pedidos no mobile;
- alteração de quantidade, remoção e esvaziamento confirmado da sacola;
- estados vazio e preenchido do dashboard;
- filtros do histórico;
- logout com remoção do token;
- encerramento da sessão com JWT inválido;
- mensagem formal em falha de comunicação simulada, sem `502`, `ECONN` ou
  texto técnico.

Na rodada inicial, foi reprovada somente a comunicação visual do JWT inválido:
a proteção funcionava e redirecionava ao login, mas não explicava ao cliente
que a sessão havia expirado. O caso foi registrado como `BUG-005` e corrigido
na Rodada 3.

### Build de produção

O build foi servido temporariamente com `vite preview` em `127.0.0.1:4173`.
As rotas públicas, autenticadas e o proxy `/api` responderam corretamente. Em
seguida, as mesmas 25 rotas foram percorridas no Edge: 25 aprovadas, sem
overflow, erro técnico ou carregamento permanente. O diagnóstico está em
`documentos/testes/evidencias/preview-bar46-ui-resultados.json`.

### Agenda e XLSX

Foram aprovados os bloqueios de dia fechado, intervalo, feriado, data especial e
ausência individual. As datas e ausências temporárias foram removidas ao final.

Também foram geradas pela interface uma planilha anual e outra somente de
setembro. Ambas abriram pelo ExcelJS e tiveram título, cores, filtro,
congelamento, formato monetário, quantidade de linhas e totais comparados com a
API. Os arquivos estão em `documentos/testes/evidencias/xlsx/`.

### Fluxos adicionais concluídos

- O wizard foi percorrido no Edge em viewport móvel, da seleção do serviço até
  a confirmação. O pagamento em dinheiro foi persistido como pendente e dois
  cliques consecutivos geraram somente um agendamento.
- O suporte flutuante apresentou os seis assuntos, montou a mensagem com
  protocolo e dados orientados e o manipulador de entrada criou uma notificação
  para cada administrador. A ligação com o evento recebido pelo Baileys também
  passou na suíte isolada.
- A redefinição de senha pela interface, a troca efetiva da credencial, o uso
  único do token e a expiração foram aprovados. O recebimento na caixa postal
  foi confirmado pelo usuário em 04/09/2026.
- Uma sessão Stripe de teste foi criada com serviço e duas unidades de produto.
  Itens e total coincidiram entre Stripe e banco; o prazo foi de dez minutos e
  houve um único lembrete programado três minutos antes. Com o relógio do
  registro avançado de forma controlada, pagamento, pedido e agendamento foram
  cancelados e a sessão foi expirada.
- Os dados temporários dessas quatro execuções foram removidos ao final.
- O webhook foi exercitado com assinatura válida e uma sessão Stripe real de
  teste; confirmou o pagamento, registrou o PaymentIntent e ignorou a repetição
  do mesmo evento. A tela aberta mudou de “Verificando pagamento” para
  “Pagamento aprovado” sem recarregar e apresentou links funcionais.
- As mensagens de reserva, lembrete e confirmação foram capturadas antes do
  transporte. Todas continham os campos previstos, o mesmo link de checkout e
  nenhum caractere de substituição; uma fila concluída não gerou reenvio.
- A saída dos 25 testes isolados de conexão, falha, reagendamento e entrada de
  mensagens está em `documentos/testes/evidencias/whatsapp-testes-isolados.tap`.
- O Checkout hospedado foi preenchido com o cartão oficial de teste da Stripe.
  O pagamento ficou pago na Stripe, confirmou pagamento e pedido no banco,
  registrou o PaymentIntent e retornou à tela “Pagamento aprovado”.
- Em uma execução separada, o clique da sacola abriu o Stripe em uma nova aba;
  a loja permaneceu aberta com status “Aguardando pagamento” e contador ativo.

### Encerramento

As confirmações externas de e-mail e WhatsApp foram recebidas, o pagamento no
Stripe Checkout foi validado e os bugs BUG-001 a BUG-005 foram corrigidos e
retestados. Não restam casos pendentes ou reprovados na matriz da BAR-46.
