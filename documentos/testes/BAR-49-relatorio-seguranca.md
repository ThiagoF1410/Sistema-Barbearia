# BAR-49 — Auditoria final de segurança

**Data:** 04/09/2026  
**Última revalidação:** 09/11/2026
**Status:** concluída  
**Escopo:** bcrypt, JWT, variáveis de ambiente, dependências, CORS, cabeçalhos HTTP, limites de entrada e proteção de rotas por perfil.

## Resultado executivo

A auditoria foi concluída sem falhas pendentes de prioridade alta ou média. Os ataques controlados somaram **12/12 aprovações**, a suíte atual do backend encerrou com **109/109 testes aprovados**, o frontend com **33/33 testes aprovados** e o controle completo de perfis continuou com **30/30 aprovações**. Backend e frontend encerraram o `npm audit` com **0 vulnerabilidades conhecidas**.

Nenhuma senha, chave privada, URL de banco ou segredo de webhook foi incluído nas evidências.

## Correções aplicadas

| ID | Risco encontrado | Correção |
| --- | --- | --- |
| SEC-001 | Dependências transitivas com avisos alto/moderado | Atualização controlada de `browserslist`, `uuid` e `qs` por `overrides`; lockfiles regenerados. |
| SEC-002 | JWT aceitava o padrão da biblioteca sem contexto fixo | Algoritmo limitado a HS256, com emissor e audiência obrigatórios; payload exige identificador positivo e versão de sessão inteira. |
| SEC-003 | A política do bcrypt não era uniforme em todos os cadastros | Validação compartilhada entre 8 e 72 caracteres/bytes, exigindo maiúscula, minúscula, número e caractere especial. |
| SEC-004 | API identificava Express e possuía cabeçalhos defensivos incompletos | Remoção de `X-Powered-By`; inclusão de CSP, Permissions-Policy e `Cache-Control: no-store`. |
| SEC-005 | Corpo JSON não tinha limite explícito da aplicação | Limite de 32 kB e resposta HTTP 413 formal, sem detalhes internos. |
| SEC-006 | Produção aceitava segredo JWT de exemplo ou validade excessiva | Bloqueio de placeholders e duração obrigatória entre 5 minutos e 30 dias. |

## Autenticação e autorização

- JWT assinado com HS256, emissor `rei-da-navalha-api`, audiência `rei-da-navalha-web` e expiração obrigatória.
- A API consulta no banco o perfil atual do usuário e a versão da sessão; não confia no campo `role` recebido no token.
- Um JWT válido de cliente com `role: admin` forjada recebeu HTTP 403.
- Tokens expirados, sem emissor/audiência, sem versão da sessão ou com identificador malformado receberam HTTP 401.
- Rotas administrativas sem token receberam HTTP 401; cliente e profissional fora de seu escopo receberam HTTP 403.
- O smoke completo de rotas por perfil foi reaplicado após a correção: **30/30 aprovado**.

Observação operacional: tokens emitidos antes deste endurecimento deixam de ser aceitos por não conterem o novo emissor e audiência. Basta o usuário entrar novamente; isso é esperado e evita manter sessões antigas com política mais fraca.

## Senhas e recuperação de acesso

- Foram verificados **12 registros de usuário** no banco configurado.
- Todos possuem hash no formato bcrypt e custo mínimo 10; nenhum hash foi copiado para o relatório.
- Cadastro de cliente, cadastro/edição de profissional e redefinição de senha usam a mesma política: 8 a 72 caracteres/bytes, com maiúscula, minúscula, número e caractere especial.
- O fluxo de recuperação usa token aleatório, armazena somente seu SHA-256, possui validade e consumo único.

## Ambiente e segredos

- `.env`, `backend/.whatsapp-session/` e arquivos equivalentes estão cobertos pelo `.gitignore`.
- O Git rastreia somente `backend/.env.example` e `frontend/.env.example`; nenhum `.env` real ou sessão do WhatsApp está versionado.
- A busca por formatos de chave Stripe e segredo de webhook em arquivos rastreados, excluindo exemplos/testes, não encontrou ocorrências.
- Em produção, a inicialização exige HTTPS, segredo de webhook Stripe e segredo JWT seguro.
- As evidências registram apenas indicadores booleanos; valores do ambiente não são exibidos.

## Superfície HTTP

| Verificação | Resultado |
| --- | --- |
| Origem CORS maliciosa | HTTP 403, sem cabeçalho de liberação |
| JSON acima de 32 kB | HTTP 413 com mensagem controlada |
| `X-Powered-By` | ausente |
| MIME sniffing | bloqueado |
| Incorporação em iframe | bloqueada |
| Cache de respostas da API | desabilitado |
| CSP e permissões de câmera/microfone/localização | restritas |
| Mensagens internas e stack trace | não expostos nos casos auditados |

## Dependências e regressão

| Verificação | Resultado |
| --- | --- |
| `npm audit` backend | 0 vulnerabilidades |
| `npm audit` frontend | 0 vulnerabilidades |
| Testes automatizados backend | 109/109 aprovados |
| Testes automatizados frontend | 33/33 aprovados |
| Smoke de perfis e rotas | 30/30 aprovados |
| ESLint frontend | aprovado |
| Build Vite de produção | aprovado |
| Exportação XLSX após atualização de `uuid` | aprovada em memória |

O build mantém somente um aviso não bloqueante: o pacote de exportação XLSX produz um chunk grande, mas ele já é carregado separadamente e não representa falha de segurança.

## Correções posteriores à auditoria

- O token de acesso deixou de ser persistido no `localStorage`; ele fica apenas em memória e é renovado por cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`.
- As sessões passaram a possuir rotação do token de renovação, revogação no logout e troca de senha, inatividade por perfil e duração máxima absoluta.
- O rate limit passou a utilizar contadores compartilhados no PostgreSQL em produção, mantendo a memória apenas para desenvolvimento, testes e contingência.
- A versão publicada ainda deve configurar a CSP também como cabeçalho HTTP no provedor de hospedagem.

## Riscos residuais aceitos

- Alertas de dependências precisam ser repetidos antes de cada entrega, pois novas vulnerabilidades podem ser publicadas após esta auditoria.

Esses itens são melhorias futuras de endurecimento e não impedem a homologação atual.

## Evidências e reprodução

- Resultado consolidado: `documentos/testes/evidencias/bar49/bar49-security-resultados.json`
- Teste de segurança focado: `backend/test/securityAudit.test.js`
- Integração HTTP: `backend/test/httpSecurityIntegration.test.js`
- Ataques controlados reproduzíveis: `backend/scripts/bar49-security-smoke.js`

Para repetir a validação com a API local ativa e o WhatsApp desabilitado:

```powershell
cd C:\Sistema-Barbearia\backend
npm test
node scripts\bar49-security-smoke.js
npm audit

cd ..\frontend
npm run lint
npm run build
npm audit
```

## Conclusão

**BAR-49 está concluída.** Os requisitos de verificação de bcrypt, JWT, ambiente e proteção de rotas foram testados, corrigidos e documentados, sem bugs de segurança pendentes no escopo definido.
