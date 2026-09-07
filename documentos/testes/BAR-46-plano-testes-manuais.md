# BAR-46 — Plano de testes manuais

## Objetivo

Validar os fluxos documentados do Sistema de Barbearia antes da homologação, registrando resultado real, evidência e defeitos encontrados. Um caso somente pode ser marcado como aprovado depois de executado; inspeção de código isolada não equivale à aprovação manual.

## Estados

- `APROVADO`: resultado obtido igual ao esperado.
- `REPROVADO`: defeito reproduzido.
- `BLOQUEADO`: dependência externa ou dado obrigatório indisponível.
- `PENDENTE`: ainda não executado.

## Ambiente de referência

- Data inicial da execução: 03/09/2026.
- API local: `http://localhost:3001`.
- Frontend local: `http://localhost:5173`.
- Banco: Neon/PostgreSQL configurado no backend.
- Stripe: modo de teste.
- WhatsApp: Baileys.

## Matriz funcional

### Ambiente e qualidade técnica

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-ENV-01 | Inicializar a API | Resposta HTTP 200 em `/` | APROVADO |
| CT-ENV-02 | Executar testes automatizados | Suíte sem falhas | APROVADO |
| CT-ENV-03 | Executar lint do frontend | Nenhum erro | APROVADO |
| CT-ENV-04 | Gerar build de produção | Build concluído | APROVADO |
| CT-ENV-05 | Abrir build e navegar pelas rotas | Todas as rotas carregam sem erro no navegador | APROVADO |

### Autenticação e perfil do cliente

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-AUTH-01 | Cadastro sem campos obrigatórios | HTTP 400 e mensagem formal | APROVADO |
| CT-AUTH-02 | Cadastro com e-mail inválido | HTTP 400 | APROVADO |
| CT-AUTH-03 | Cadastro válido | HTTP 201, JWT e perfil cliente | APROVADO |
| CT-AUTH-04 | E-mail duplicado | HTTP 409 | APROVADO |
| CT-AUTH-05 | Login com senha incorreta | HTTP 401 sem informar qual campo falhou | APROVADO |
| CT-AUTH-06 | Login válido | HTTP 200 e JWT | APROVADO |
| CT-AUTH-07 | Consultar perfil sem token | HTTP 401 | APROVADO |
| CT-AUTH-08 | Consultar perfil com token | HTTP 200 | APROVADO |
| CT-PERFIL-01 | Atualizar com telefone inválido | HTTP 400 | APROVADO |
| CT-PERFIL-02 | Atualizar dados válidos | HTTP 200 e dados normalizados | APROVADO |
| CT-AUTH-09 | Recuperação completa de senha pelo e-mail | Link recebido, token utilizado uma vez e login com nova senha | APROVADO — entrega confirmada pelo usuário em 04/09/2026; token, uso único e nova senha já validados |
| CT-AUTH-10 | Logout pela interface | Sessão removida e rota protegida bloqueada | APROVADO |
| CT-AUTH-11 | JWT expirado/revogado na interface | Sessão encerrada com mensagem apropriada | APROVADO — correção do BUG-005 retestada em 04/09/2026 |

### Autorização

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-SEC-01 | Cliente acessa agendamentos administrativos | HTTP 403 | APROVADO |
| CT-SEC-02 | Cliente acessa notificações internas | HTTP 403 | APROVADO |
| CT-SEC-03 | Cliente tenta editar serviço | HTTP 403 | APROVADO |
| CT-PROF-07 | Profissional tenta acessar gestão de clientes | HTTP 403 | APROVADO |
| CT-SEC-04 | Acessar URL administrativa no navegador como cliente | Redirecionamento seguro e ausência de dados administrativos | APROVADO |

### Serviços e catálogo

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-CAT-01 | Listar catálogo público | HTTP 200 | APROVADO |
| CT-SERV-01 | Criar serviço inválido | HTTP 400 | APROVADO |
| CT-SERV-02 | Criar serviço válido | HTTP 201 | APROVADO |
| CT-SERV-03 | Consultar serviço criado | HTTP 200 | APROVADO |
| CT-SERV-04 | Editar serviço | HTTP 200 e dados alterados | APROVADO |
| CT-SERV-05 | Excluir serviço sem vínculos | HTTP 200 | APROVADO |
| CT-SERV-06 | Consultar serviço removido | HTTP 404 | APROVADO |
| CT-SERV-07 | Excluir serviço com registros vinculados | HTTP 409 e preservação do histórico | APROVADO |
| CT-CAT-02 | Separação visual entre serviços e produtos | Cada área apresenta apenas o tipo correspondente | APROVADO |

### Agenda e agendamento

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-AGENDA-01 | Consultar calendário com ano/mês inválidos | HTTP 400 | APROVADO |
| CT-AGENDA-02 | Consultar calendário mensal | HTTP 200 | APROVADO |
| CT-AGENDA-03 | Consultar horários com parâmetros inválidos | HTTP 400 | APROVADO |
| CT-AGEND-01 | Preparar cliente do fluxo | HTTP 201 | APROVADO |
| CT-AGEND-02 | Carregar serviços | HTTP 200 | APROVADO |
| CT-AGEND-03 | Carregar profissionais | HTTP 200 | APROVADO |
| CT-AGEND-04 | Agendar no passado | HTTP 409 | APROVADO |
| CT-AGEND-05 | Listar horários por serviço/profissional | Apenas horários compatíveis com duração e expediente | APROVADO |
| CT-AGEND-06 | Criar agendamento válido | HTTP 201 | APROVADO |
| CT-AGEND-07 | Criar conflito no mesmo horário | HTTP 409 | APROVADO |
| CT-AGEND-08 | Reconsultar agenda após reserva | HTTP 200 | APROVADO |
| CT-AGEND-09 | Verificar bloqueio do horário reservado | Horário ausente da disponibilidade | APROVADO |
| CT-AGEND-10 | Consultar histórico após reservar | Agendamento presente | APROVADO |
| CT-AGEND-11 | Cancelar com mais de duas horas | HTTP 200 | APROVADO |
| CT-AGEND-12 | Cancelar novamente | HTTP 409 | APROVADO |
| CT-AGEND-13 | Reconsultar agenda após cancelamento | HTTP 200 | APROVADO |
| CT-AGEND-14 | Verificar liberação após cancelamento | Horário novamente disponível | APROVADO |
| CT-AGEND-15 | Tentar cancelar com menos de duas horas | HTTP 409 | APROVADO |
| CT-AGEND-16 | Wizard completo na interface | Serviço, profissional, data, horário e confirmação coerentes | APROVADO |
| CT-AGEND-17 | Datas bloqueadas, feriados, intervalos e ausências | Não oferecem horários incompatíveis | APROVADO |
| CT-AGEND-18 | Dois clientes enviam a reserva simultaneamente | Somente uma reserva confirmada | APROVADO |

### Administração

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-ADMIN-01 | Consultar perfil administrativo | HTTP 200 e perfil admin | APROVADO |
| CT-ADMIN-02 | Carregar dashboard | HTTP 200 | APROVADO |
| CT-ADMIN-03 | Filtrar agendamentos por período | HTTP 200 | APROVADO |
| CT-ADMIN-04 | Informar situação inválida | HTTP 400 | APROVADO |
| CT-ADMIN-05 | Listar pagamentos | HTTP 200 | APROVADO |
| CT-ADMIN-06 | Filtrar por situação inválida | HTTP 400 | APROVADO |
| CT-ADMIN-07 | Gerar relatório anual | HTTP 200 e doze meses | APROVADO |
| CT-ADMIN-08 | Consultar relatório com ano inválido | HTTP 400 | APROVADO |
| CT-ADMIN-09 | Listar datas especiais | HTTP 200 | APROVADO |
| CT-ADMIN-10 | Listar horários de funcionamento | HTTP 200 | APROVADO |
| CT-ADMIN-11 | Listar feriados | HTTP 200 | APROVADO |
| CT-ADMIN-12 | Listar gestão de profissionais | HTTP 200 | APROVADO |
| CT-ADMIN-13 | Listar gestão de clientes | HTTP 200 | APROVADO |
| CT-ADMIN-14 | Listar solicitações de ausência | HTTP 200 | APROVADO |
| CT-ADMIN-15 | Listar notificações | HTTP 200 | APROVADO |
| CT-ADMIN-16 | Editar horários e restaurar configuração original | Alteração refletida e restauração concluída | APROVADO |
| CT-ADMIN-17 | Criar/bloquear/liberar/remover data especial | Calendário reflete cada alteração | APROVADO |
| CT-ADMIN-18 | Cadastrar, editar e desativar profissional | Fluxo completo e sessões revogadas quando aplicável | APROVADO |
| CT-ADMIN-19 | Editar cliente preservando histórico | Dados atualizados sem perder agendamentos | APROVADO |
| CT-ADMIN-20 | Concluir atendimento somente após seu término | Antes: HTTP 409; depois: HTTP 200 | APROVADO |
| CT-ADMIN-21 | Exportar XLSX anual e mensal | Arquivo abre formatado e totais conferem | APROVADO |

### Área profissional

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-PROF-01 | Consultar perfil profissional | HTTP 200 | APROVADO |
| CT-PROF-02 | Carregar dashboard profissional | HTTP 200 | APROVADO |
| CT-PROF-03 | Consultar expediente próprio | HTTP 200 | APROVADO |
| CT-PROF-04 | Consultar ausências aprovadas | HTTP 200 | APROVADO |
| CT-PROF-05 | Consultar solicitações próprias | HTTP 200 | APROVADO |
| CT-PROF-06 | Consultar notificações | HTTP 200 | APROVADO |
| CT-PROF-08 | Enviar solicitação inválida | HTTP 400 | APROVADO |
| CT-PROF-09 | Solicitar folga e cancelar enquanto pendente | Solicitação criada e cancelada pelo próprio profissional | APROVADO |
| CT-PROF-10 | Aprovar e recusar solicitação como administrador | Status, resposta e bloqueio de agenda atualizados | APROVADO |

### Loja, pedidos e Stripe

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-LOJA-01 | Preparar cliente da loja | HTTP 201 | APROVADO |
| CT-LOJA-02 | Carregar catálogo | HTTP 200 | APROVADO |
| CT-LOJA-03 | Finalizar sacola vazia | HTTP 400 | APROVADO |
| CT-LOJA-04 | Usar serviço como produto | HTTP 409 | APROVADO |
| CT-LOJA-05 | Quantidade acima do limite | HTTP 400 | APROVADO |
| CT-LOJA-06 | Criar pedido em dinheiro | HTTP 201 | APROVADO |
| CT-LOJA-07 | Consultar pedido criado | Pedido presente | APROVADO |
| CT-LOJA-08 | Abrir checkout online de pedido em dinheiro | HTTP 409 | APROVADO |
| CT-LOJA-09 | Cancelar pedido pendente | HTTP 200 | APROVADO |
| CT-LOJA-10 | Cancelar novamente | HTTP 200 sem duplicar efeitos | APROVADO |
| CT-STRIPE-01 | Criar checkout online | HTTP 201 | APROVADO |
| CT-STRIPE-02 | Validar resposta do checkout | URL HTTPS, `cs_`, pedido e expiração | APROVADO |
| CT-STRIPE-03 | Retomar checkout | Reutiliza sessão ainda aberta | APROVADO |
| CT-STRIPE-04 | Cancelar pedido com checkout aberto | Sessão expirada e pedido cancelado | APROVADO |
| CT-STRIPE-05 | Pagar pedido cancelado | HTTP 409 | APROVADO |
| CT-STRIPE-06 | Concluir pagamento com cartão de teste | Stripe confirma e webhook atualiza o banco | APROVADO |
| CT-STRIPE-07 | Atualização automática na aba original | Status muda para confirmado sem recarregar | APROVADO |
| CT-STRIPE-08 | Página de retorno após aprovação | Mensagem de pagamento aprovado e navegação funcional | APROVADO |
| CT-STRIPE-09 | Expiração após dez minutos | Pedido/agendamento cancelado automaticamente | APROVADO — relógio do registro avançado de forma controlada |
| CT-STRIPE-10 | Lembrete aos três minutos restantes | Uma única notificação enviada | APROVADO — horário, unicidade e recebimento no celular confirmados |
| CT-STRIPE-11 | Pagamento de serviço com produto adicional | Total e itens conferem no Stripe e banco | APROVADO |

### WhatsApp e notificações

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-WPP-01 | Conectar sessão do Baileys | Estado conectado sem novo QR | APROVADO |
| CT-WPP-02 | Enviar reserva aguardando pagamento | Mensagem chega ao número do cliente | APROVADO — conteúdo e recebimento no celular confirmados em 04/09/2026 |
| CT-WPP-03 | Enviar lembrete | Prazo correto e sem duplicidade | APROVADO — conteúdo, unicidade e recebimento no celular confirmados em 04/09/2026 |
| CT-WPP-04 | Enviar confirmação | Serviço, data, horário e profissional corretos | APROVADO — conteúdo e recebimento no celular confirmados em 04/09/2026 |
| CT-WPP-05 | Abrir suporte flutuante | Opções e mensagem preenchida corretamente | APROVADO |
| CT-WPP-06 | Cliente enviar mensagem de suporte | Administrador recebe notificação interna | APROVADO — evento de entrada simulado no manipulador do Baileys e banco real |
| CT-WPP-07 | WhatsApp desconectado | Falha controlada, reagendamento e mensagem formal | APROVADO — cliente simulado para preservar a sessão real |

### Interface e falhas

| ID | Caso | Resultado esperado | Estado |
|---|---|---|---|
| CT-UI-01 | Dashboard do cliente vazio e preenchido | Estados visuais corretos | APROVADO |
| CT-UI-02 | Histórico e filtros do cliente | Contadores e cartões coerentes | APROVADO |
| CT-UI-03 | Loja: abas Produtos/Meus pedidos | Navegação preserva estado e funciona no mobile | APROVADO |
| CT-UI-04 | Sacola em tela separada | Quantidade, remoção e esvaziamento corretos | APROVADO |
| CT-UI-05 | Menu administrativo | Somente a rota atual fica selecionada | APROVADO |
| CT-UI-06 | Calendário sobreposto a cartões | Calendário permanece no topo e utilizável | APROVADO |
| CT-UI-07 | Backend desligado | Mensagem formal, sem `502` técnico | APROVADO |
| CT-UI-08 | Rota inexistente | Página ou redirecionamento apropriado | APROVADO |
| CT-UI-09 | Duplo clique em ações | Não duplica cadastro, pedido ou agendamento | APROVADO — confirmação do agendamento |
| CT-UI-10 | Foco automático no título da etapa | Foco acessível sem moldura visual indevida | APROVADO — correção do BUG-004 retestada em 04/09/2026 |

## Evidências de renderização

Além dos casos funcionais, 25 rotas autenticadas foram capturadas no Edge em
desktop e mobile. Todas passaram nas verificações automáticas de rota correta,
ausência de overflow horizontal, ausência de erro técnico e término do estado
de carregamento. As imagens e o relatório JSON estão em
`documentos/testes/evidencias/`.

## Critério de encerramento

A BAR-46 somente será concluída quando todos os casos desta matriz estiverem em `APROVADO`, ou quando uma exceção não crítica estiver formalmente aceita e documentada. Não pode haver defeito crítico ou alto aberto.

**Critério atendido em 04/09/2026:** todos os casos da matriz estão aprovados,
as entregas externas foram confirmadas e não há defeito crítico ou alto aberto.
