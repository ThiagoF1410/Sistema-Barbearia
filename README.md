# O Rei da Navalha

Sistema web desenvolvido como TCC para administrar uma barbearia: catálogo de serviços e produtos, agendas individuais por profissional, agendamentos, pedidos, pagamentos, notificações e relatórios.

## Funcionalidades

### Cliente

- Cadastro, login e recuperação de senha por e-mail.
- Agendamento por serviço, profissional, data e horário.
- Pagamento on-line pelo Stripe ou pagamento em dinheiro na barbearia.
- Compra avulsa de produtos e inclusão de produtos no agendamento.
- Prazo de 10 minutos para pagamento on-line, com atualização automática do status.
- Histórico de atendimentos, pedidos e pagamentos.
- Perfil editável e suporte pelo WhatsApp.

### Profissional

- Painel próprio com agenda diária e detalhes dos atendimentos.
- Consulta da escala, folgas e férias aprovadas.
- Solicitação de folga ou férias para análise do administrador.

### Administrador

- Dashboard com indicadores e agenda do dia.
- Gestão de serviços, produtos, profissionais e clientes.
- Configuração do funcionamento geral e da agenda de cada profissional.
- Gestão de feriados, datas especiais, folgas e férias.
- Consulta e conclusão de atendimentos.
- Controle de pagamentos on-line e recebimentos em dinheiro.
- Relatório mensal com exportação XLSX formatada.
- Central de notificações para novos agendamentos, pedidos e solicitações.

## Tecnologias

- Frontend: React 19, Vite 8, Tailwind CSS 4 e Axios.
- Backend: Node.js, Express 5 e PostgreSQL.
- Banco: PostgreSQL/Neon.
- Autenticação: JWT e bcrypt.
- Pagamento: Stripe Checkout e webhook assinado.
- Mensagens: Baileys/WhatsApp Web.
- E-mail: Nodemailer/SMTP.
- Planilhas: ExcelJS.

## Pré-requisitos

- Node.js 20.19 ou superior.
- npm.
- Banco PostgreSQL ou projeto no Neon.
- Conta Stripe em modo de teste para validar pagamentos.
- Conta SMTP para testar recuperação de senha.
- WhatsApp disponível para ler o QR Code, caso a integração seja habilitada.

## Instalação local

1. Clone ou abra o projeto.
2. Instale as dependências:

```powershell
cd C:\Sistema-Barbearia\backend
npm install

cd ..\frontend
npm install
```

3. Copie os exemplos de ambiente sem excluir os arquivos `.env.example`:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

4. Preencha `backend/.env` e, quando necessário, `frontend/.env`.
5. Em um banco vazio, execute todos os arquivos de `backend/migrations` em ordem numérica, começando por `000_schema_base.sql`.
6. Inicie os dois processos em terminais separados:

```powershell
cd C:\Sistema-Barbearia\backend
npm run dev
```

```powershell
cd C:\Sistema-Barbearia\frontend
npm run dev
```

7. Acesse `http://localhost:5173`.

O backend utiliza a porta 3001 e o frontend a porta 5173. O Vite encaminha `/api` para o backend durante o desenvolvimento.

## Atualização de um banco existente

Não execute `000_schema_base.sql` retroativamente em um banco que já possui dados. Aplique somente as migrações ainda pendentes, sempre em ordem. Para a versão atual, a sequência posterior à consolidação financeira é:

1. `014_consolidar_pagamentos_e_faturamento.sql`
2. `015_disponibilidade_profissional.sql`
3. `016_revogacao_tokens_e_recuperacao.sql`
4. `017_snapshot_servico_agendamento.sql`
5. `018_limpeza_indices.sql`
6. `019_notificacoes_whatsapp.sql`
7. `020_catalogo_servicos_produtos.sql`
8. `021_grade_30_e_duracoes_servicos.sql`
9. `022_pedidos_produtos.sql`
10. `023_data_cadastro_cliente.sql`
11. `024_solicitacoes_ausencia_profissional.sql`
12. `025_prazo_pagamento_online.sql`
13. `026_central_notificacoes.sql`
14. `027_indices_paginacao_relatorios.sql`

As migrações 016 e o endurecimento atual do JWT invalidam sessões antigas de maneira intencional. Depois da atualização, entre novamente no sistema.

## Configuração do ambiente

Nunca substitua o `.env.example` pelo `.env` definitivo e nunca envie o `.env` ao Git. O arquivo de exemplo documenta os nomes; o arquivo real guarda valores privados apenas na máquina ou na hospedagem.

| Variável | Finalidade |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `PORT` | Porta da API |
| `FRONTEND_URL` | Origem oficial usada em CORS, e-mail e retorno do Stripe |
| `DATABASE_URL` | Conexão PostgreSQL/Neon |
| `DB_POOL_MAX` | Limite de conexões simultâneas do pool (padrão: 10) |
| `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS` | Tempos de ociosidade e abertura de conexão do PostgreSQL |
| `DB_HOST` a `DB_SSL` | Alternativa à URL única para PostgreSQL local |
| `JWT_SECRET` | Segredo aleatório com no mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | Validade entre 5 minutos e 30 dias, como `7d` |
| `EMAIL_USER`, `EMAIL_PASS` | Credenciais SMTP |
| `SMTP_HOST`, `SMTP_PORT` | Servidor SMTP |
| `STRIPE_MODE` | `test` ou `live` |
| `STRIPE_SECRET_KEY` | Chave privada coerente com o modo Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo `whsec_` do destino do webhook |
| `WHATSAPP_ENABLED` | Habilita o cliente Baileys |
| `WHATSAPP_SESSION_DIR` | Diretório privado e persistente da sessão |
| `WHATSAPP_TIMEOUT_MS` | Limite de espera das operações |
| `WHATSAPP_RECONNECT_MS` | Intervalo de reconexão |
| `WHATSAPP_NOTIFICATION_INTERVAL_MS` | Frequência de processamento da fila |
| `WHATSAPP_CONTACT_NUMBER` | Telefone público da barbearia em formato `55 + DDD + número` |
| `WHATSAPP_TEST_ENDPOINT_ENABLED` | Habilita o endpoint administrativo de teste |
| `WHATSAPP_TEST_RECIPIENT` | Destinatário autorizado do teste |
| `WHATSAPP_TEST_MESSAGE` | Mensagem enviada pelo teste |

Variáveis públicas do frontend:

| Variável | Finalidade |
| --- | --- |
| `VITE_API_URL` | Base da API; localmente use `/api` |
| `VITE_BARBEARIA_ENDERECO` | Endereço exibido na página inicial |
| `VITE_BARBEARIA_MAPA_URL` | URL pública do mapa |
| `VITE_DEPOIMENTO_TEXTO` | Depoimento autorizado |
| `VITE_DEPOIMENTO_AUTOR` | Autor do depoimento |

Tudo que começa com `VITE_` é incorporado ao frontend e deve ser considerado público.

## Stripe em desenvolvimento

Use apenas chaves `sk_test_` e cartões de teste. Para receber webhooks localmente:

```powershell
stripe login
stripe listen --forward-to localhost:3001/api/pagamentos/webhook
```

Copie o segredo `whsec_` exibido pelo segundo comando para `STRIPE_WEBHOOK_SECRET` e reinicie o backend. O terminal do `stripe listen` precisa permanecer aberto apenas durante o teste local. Na hospedagem, configure um destino HTTPS no painel Stripe; a CLI deixa de ser necessária.

Se o site for acessado por outro dispositivo da rede, mantenha o frontend iniciado com `--host` e use a origem acessível ao dispositivo. O backend aceita origens privadas no retorno do Checkout somente em desenvolvimento.

## WhatsApp

A sessão fica em `backend/.whatsapp-session` por padrão. Ela contém credenciais privadas, está ignorada pelo Git e não deve ser copiada para documentação ou repositório. Veja [backend/WHATSAPP.md](backend/WHATSAPP.md) para conexão, testes e recuperação de sessão.

O Baileys é uma integração não oficial baseada no WhatsApp Web. Para uma implantação comercial, a API oficial do WhatsApp Business é a opção recomendada.

## Segurança

- Senhas são armazenadas com bcrypt, nunca em texto puro.
- Novas senhas exigem 8 a 72 caracteres/bytes, maiúscula, minúscula, número e caractere especial.
- JWT usa HS256, emissor, audiência, expiração e versão de sessão.
- O perfil efetivo é consultado no banco; alterar o `role` do token não eleva privilégios.
- Rotas administrativas e profissionais possuem autorização no backend e no frontend.
- Produção exige HTTPS, segredo do webhook e configurações válidas.
- CORS, limite de JSON, rate limit e cabeçalhos defensivos são aplicados pela API.

Consulte [documentos/testes/BAR-49-relatorio-seguranca.md](documentos/testes/BAR-49-relatorio-seguranca.md) para a auditoria completa.

## Validação

```powershell
cd C:\Sistema-Barbearia\backend
npm test
npm audit

cd ..\frontend
npm run lint
npm run build
npm audit
```

Os relatórios da Sprint 6 estão em `documentos/testes`.

## Documentação complementar

- [Arquitetura e fluxos](documentos/ARQUITETURA-E-FLUXOS.md)
- [Referência da API](documentos/API.md)
- [Status da Sprint 6](documentos/SPRINT-6-STATUS.md)
- [Integração com WhatsApp](backend/WHATSAPP.md)
- [Roteiro de testes manuais](documentos/testes/BAR-46-plano-testes-manuais.md)

## Estado da entrega

As BAR-46, BAR-47, BAR-48, BAR-49, BAR-50 e BAR-51 estão concluídas. A etapa seguinte é a BAR-52: publicação em homologação e validação com o orientador.
