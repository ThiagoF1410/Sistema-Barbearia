# Referência da API

Base local: `http://localhost:3001/api`

Rotas protegidas recebem `Authorization: Bearer <jwt>`. Os perfis são `cliente`, `profissional` e `admin`. Códigos usuais: 200/201 sucesso, 400 entrada inválida, 401 autenticação ausente/inválida, 403 perfil sem permissão, 404 recurso inexistente, 409 conflito e 429 excesso de tentativas.

## Autenticação

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `POST /auth/register` | público | cadastrar cliente |
| `POST /auth/login` | público | autenticar e emitir JWT |
| `GET /auth/me` | autenticado | consultar perfil atual |
| `PATCH /auth/me` | cliente | atualizar nome, e-mail e telefone |
| `POST /auth/forgot-password` | público | solicitar recuperação sem revelar se o e-mail existe |
| `POST /auth/reset-password` | público com token | redefinir senha e revogar sessões anteriores |
| `GET /auth/admin/usuarios` | admin | listar usuários |

Cadastro exige `nome`, `email`, `telefone` e `password`. Novas senhas devem ter 8 a 72 caracteres/bytes, com maiúscula, minúscula, número e caractere especial.

### Paginação de listagens

As rotas `GET /clientes/gestao`, `GET /agendamentos/meus`, `GET /agendamentos/admin`, `GET /pagamentos/admin` e `GET /pedidos/meus` aceitam `pagina` e `limite` (máximo 50). Quando esses parâmetros são enviados, a resposta inclui `paginacao` com total, total de páginas e indicadores de navegação. Os filtros de busca e status são processados no banco antes da paginação.

## Clientes

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `POST /clientes` | público | rota compatível de cadastro |
| `GET /clientes/gestao` | admin | listar e pesquisar clientes |
| `GET /clientes/:id/agendamentos` | admin | consultar histórico do cliente |
| `PUT /clientes/:id` | admin | atualizar dados do cliente |

## Serviços e produtos

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `GET /servicos` | público | listar catálogo |
| `GET /servicos/:id` | público | buscar item |
| `POST /servicos` | admin | criar serviço ou produto |
| `PUT /servicos/:id` | admin | editar item |
| `DELETE /servicos/:id` | admin | excluir quando permitido |

## Agenda

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `GET /agenda/disponivel` | autenticado | listar datas disponíveis |
| `GET /agenda/calendario` | autenticado | obter calendário mensal |
| `GET /agenda/horarios-disponiveis` | autenticado | calcular horários livres |
| `GET /agenda/horarios` | público | consultar funcionamento geral |
| `GET /agenda` | admin | listar datas especiais |
| `PUT /agenda/horarios` | admin | salvar funcionamento geral |
| `POST /agenda` | admin | criar data especial |
| `PATCH /agenda/:id/disponibilidade` | admin | bloquear ou liberar data |
| `DELETE /agenda/:id` | admin | excluir data especial |
| `GET /agenda/feriados` | admin | listar feriados; aceita `ano` na query |
| `POST /agenda/feriados/importar/:ano` | admin | importar feriados |
| `PATCH /agenda/feriados/:id` | admin | alterar regra do feriado |

### Escala por profissional

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `GET /agenda/profissionais/:profissionalId/horarios` | admin | consultar escala |
| `PUT /agenda/profissionais/:profissionalId/horarios` | admin | salvar escala |
| `GET /agenda/profissionais/:profissionalId/ausencias` | admin | listar ausências |
| `POST /agenda/profissionais/:profissionalId/ausencias` | admin | registrar ausência |
| `DELETE /agenda/profissionais/:profissionalId/ausencias/:ausenciaId` | admin | remover ausência |
| `GET /agenda/profissional/horarios` | profissional | consultar a própria escala |
| `GET /agenda/profissional/ausencias` | profissional | consultar ausências aprovadas |
| `GET /agenda/profissional/solicitacoes-ausencia` | profissional | listar solicitações |
| `POST /agenda/profissional/solicitacoes-ausencia` | profissional | solicitar folga ou férias |
| `DELETE /agenda/profissional/solicitacoes-ausencia/:solicitacaoId` | profissional | cancelar solicitação pendente |
| `GET /agenda/solicitacoes-ausencia` | admin | listar solicitações |
| `PATCH /agenda/solicitacoes-ausencia/:solicitacaoId` | admin | aprovar ou recusar |

## Profissionais

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `GET /profissionais` | autenticado | listar profissionais disponíveis |
| `GET /profissionais/me` | profissional | consultar perfil profissional |
| `GET /profissionais/gestao` | admin | listar equipe para gestão |
| `POST /profissionais` | admin | cadastrar profissional e acesso |
| `PUT /profissionais/:id` | admin | atualizar profissional |
| `PATCH /profissionais/:id/status` | admin | ativar ou desativar |

## Agendamentos

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `POST /agendamentos` | cliente | criar agendamento |
| `GET /agendamentos/meus` | cliente | consultar histórico próprio |
| `PATCH /agendamentos/:id/cancelar` | cliente | cancelar respeitando antecedência |
| `GET /agendamentos/profissional/dashboard` | profissional | consultar agenda própria |
| `GET /agendamentos/admin/dashboard` | admin | obter indicadores e agenda do dia |
| `GET /agendamentos/admin` | admin | listar com filtros |
| `PATCH /agendamentos/:id/concluir` | admin | concluir atendimento |

## Pagamentos

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `POST /pagamentos/checkout` | cliente | criar ou reabrir Checkout do agendamento |
| `POST /pagamentos/dinheiro` | cliente | registrar escolha por dinheiro |
| `GET /pagamentos/checkout/:sessionId` | cliente proprietário | reconciliar e consultar sessão |
| `GET /pagamentos/admin` | admin | listar pagamentos com filtros |
| `GET /pagamentos/admin/relatorio-mensal` | admin | obter relatório anual mensalizado; exige `ano` na query |
| `PATCH /pagamentos/admin/:pagamentoId/confirmar-dinheiro` | admin | confirmar recebimento em dinheiro |
| `POST /pagamentos/webhook` | Stripe | receber evento assinado com corpo bruto |

O Checkout on-line expira após 10 minutos. O backend consulta a Stripe antes de cancelar localmente para não descartar um pagamento aprovado próximo ao limite.

## Pedidos

Todas as rotas abaixo exigem cliente autenticado e validam a propriedade do pedido.

| Método e rota | Finalidade |
| --- | --- |
| `GET /pedidos/meus` | listar pedidos próprios |
| `POST /pedidos/checkout` | criar pedido e Checkout on-line |
| `POST /pedidos/dinheiro` | criar pedido em dinheiro |
| `POST /pedidos/:id/checkout` | retomar pagamento permitido |
| `PATCH /pedidos/:id/cancelar` | cancelar pedido permitido |

## WhatsApp

| Método e rota | Acesso | Finalidade |
| --- | --- | --- |
| `GET /whatsapp/status` | admin | consultar conexão sem expor sessão |
| `GET /whatsapp/contato` | cliente | obter contato público da barbearia |
| `POST /whatsapp/teste` | admin e ambiente habilitado | enviar teste controlado |

## Notificações

Disponíveis para administrador e profissional; cada consulta é limitada ao destinatário autenticado.

| Método e rota | Finalidade |
| --- | --- |
| `GET /notificacoes` | listar notificações |
| `PATCH /notificacoes/lidas` | marcar todas como lidas |
| `PATCH /notificacoes/:id/lida` | marcar uma como lida |

## Webhook Stripe local

```powershell
stripe listen --forward-to localhost:3001/api/pagamentos/webhook
```

Não envie eventos manualmente sem assinatura. O segredo `whsec_` pertence ao ambiente em que o destino foi criado.
