# Arquitetura e fluxos do sistema

## Visão geral

O projeto é dividido em uma aplicação React e uma API Express. O PostgreSQL concentra dados e regras críticas de integridade. Serviços externos são acessados exclusivamente pelo backend.

```text
Navegador (React/Vite)
        |
        | HTTPS + JSON + JWT
        v
API Express (Node.js)
   |        |         |
   v        v         v
PostgreSQL  Stripe    SMTP / WhatsApp
```

## Componentes

| Componente | Responsabilidade |
| --- | --- |
| `frontend/src/pages` | Telas públicas e painéis por perfil |
| `frontend/src/components` | Componentes visuais reutilizáveis |
| `frontend/src/services` | Comunicação com `/api` |
| `frontend/src/context/AuthContext.jsx` | Sessão do navegador e recuperação do perfil |
| `backend/server.js` | Inicialização, CORS, webhooks, middlewares e rotas |
| `backend/src/routes` | Contratos HTTP e autorização por perfil |
| `backend/src/controllers` | Regras de aplicação e transações |
| `backend/src/services` | Stripe, WhatsApp, notificações, expiração e pedidos |
| `backend/src/config` | Banco e validação do ambiente |
| `backend/migrations` | Evolução versionada do banco |

## Perfis e permissões

| Recurso | Cliente | Profissional | Administrador |
| --- | --- | --- | --- |
| Catálogo | consulta | — | CRUD |
| Agendamento | cria, consulta e cancela dentro da regra | consulta os próprios | consulta todos e conclui |
| Agenda | consulta disponibilidade | consulta escala e solicita ausência | configura tudo e aprova ausências |
| Pedidos | cria, paga, consulta e cancela quando permitido | — | acompanha pagamentos |
| Perfil | consulta e edita os próprios dados | consulta o próprio | gerencia clientes/profissionais |
| Notificações internas | — | próprias | administrativas |
| Relatórios | — | — | consulta e exporta XLSX |

A autorização real ocorre na API. O frontend apenas evita navegação indevida e não substitui o `authMiddleware` e o `roleGuard`.

## Fluxo de autenticação

1. O usuário envia e-mail e senha.
2. A API compara a senha com o hash bcrypt.
3. O perfil atual e ativo é resolvido no banco.
4. A API emite JWT com identificador, versão da sessão, emissor, audiência e expiração.
5. A cada requisição protegida, a API valida o token e consulta novamente o perfil e `token_version`.
6. Redefinir a senha incrementa `token_version` e encerra as sessões anteriores.

## Fluxo de agendamento

1. O cliente escolhe serviço, profissional, data e horário.
2. A disponibilidade considera duração do serviço, expediente individual, intervalo, feriados, datas especiais, ausências e conflitos.
3. O banco impede sobreposição de agendamentos ativos.
4. O cliente escolhe pagamento on-line ou dinheiro.
5. Cancelamento pelo cliente é permitido somente com pelo menos duas horas de antecedência.

## Fluxo de pagamento on-line

1. A API cria uma reserva e uma sessão Stripe idempotente.
2. O Checkout abre em outra aba; o site permanece exibindo status e contador.
3. O prazo é de 10 minutos. A notificação informa o limite e outra mensagem pode ser enviada quando restarem aproximadamente 3 minutos.
4. O webhook Stripe, validado por assinatura, confirma, falha ou cancela o pagamento.
5. A tela consulta o status e atualiza automaticamente.
6. Se o prazo terminar sem confirmação, o processador reconcilia a sessão Stripe antes de cancelar o pagamento e liberar o horário/pedido.

O retorno visual do navegador melhora a experiência, mas o webhook e a reconciliação são as fontes confiáveis do pagamento.

## Pagamento em dinheiro

- O agendamento ou pedido é criado como pendente em dinheiro.
- Não existe redirecionamento ao Stripe nem contagem regressiva.
- O administrador confirma o recebimento; somente então o valor entra no faturamento confirmado.

## Produtos

- Compra avulsa: produtos são adicionados à sacola e geram um pedido independente.
- Adicional no atendimento: os produtos são vinculados ao agendamento e cobrados no mesmo pagamento.
- Nome, preço e quantidade são recalculados com dados do banco; o backend não confia no total enviado pelo navegador.
- Pedidos confirmados ou cancelados não podem receber um novo pagamento.

## Folgas e férias

1. O profissional envia uma solicitação.
2. A administração recebe uma notificação.
3. O administrador aprova ou recusa, informando resposta quando necessário.
4. Somente a aprovação cria a indisponibilidade que bloqueia a agenda.
5. O profissional acompanha o resultado no próprio painel.

## Notificações

- A central interna usa registros por destinatário e evita duplicidade por chave de evento.
- A fila do WhatsApp registra tentativas, recupera itens abandonados e não desfaz um pagamento confirmado se o envio falhar.
- O suporte flutuante prepara uma mensagem por assunto; a notificação administrativa é registrada quando a mensagem é realmente recebida pelo WhatsApp conectado.

## Integridade e segurança

- Queries utilizam parâmetros SQL.
- Transações agrupam alterações que precisam ser atômicas.
- Triggers e índices reforçam conflitos, status e notificações.
- Segredos ficam no backend e em variáveis de ambiente.
- O webhook recebe corpo bruto antes do parser JSON.
- A API limita requisições sensíveis, tamanho do corpo e origens CORS.
- O token de acesso permanece apenas na memória do navegador e expira em 15 minutos.
- A renovação usa cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`, com rotação do segredo a cada uso.
- As sessões administrativas e profissionais expiram por inatividade e por duração máxima; clientes podem permanecer conectados por até sete dias.
- Em produção, o rate limit usa contadores compartilhados no PostgreSQL e chaves anonimizadas por SHA-256.

## Limitações conhecidas e evoluções

- O Baileys depende de uma sessão persistente do WhatsApp Web e não é uma API oficial.
- O rate limit usa memória apenas em desenvolvimento e testes; a produção depende da migration 032 no PostgreSQL.
- O cookie de renovação pressupõe frontend e API no mesmo site. Uma hospedagem futura em sites diferentes exige rever `SameSite` e incluir proteção CSRF específica.
- A rota legada `/admin/config` redireciona para o painel administrativo e não integra o escopo funcional atual.
