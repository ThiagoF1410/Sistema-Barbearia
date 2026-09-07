# BAR-46 — Registro de bugs e não conformidades

## Resumo

| ID | Prioridade | Situação | Título |
|---|---|---|---|
| BUG-001 | Alta | Corrigido e retestado em 04/09/2026 | Rota alternativa de cadastro não possui rate limiting |
| BUG-002 | Alta | Corrigido e retestado em 04/09/2026 | Exemplo de ambiente do backend removido do repositório |
| BUG-003 | Média | Corrigido e retestado em 04/09/2026 | README não documenta as migrations 019 a 026 |
| BUG-004 | Média | Corrigido e retestado em 04/09/2026 | Título da etapa do agendamento exibe moldura de foco indevida |
| BUG-005 | Média | Corrigido e retestado em 04/09/2026 | Sessão inválida redireciona ao login sem informar o motivo |
| MEL-001 | Baixa | Backlog | Chunk de exportação XLSX acima de 500 kB |

## BUG-001 — Cadastro permite contornar o rate limiting

- Área: autenticação e segurança.
- Evidência: `/api/auth/register` utiliza `limitarAutenticacao`, enquanto `POST /api/clientes` chama o mesmo cadastro sem o limitador.
- Resultado esperado: todas as entradas públicas que criam clientes devem aplicar a mesma limitação.
- Resultado atual: um agente pode trocar de rota e continuar enviando tentativas.
- Impacto: criação automatizada de contas, abuso de recursos e inconsistência na proteção da BAR-49.
- Correção recomendada: aplicar `limitarAutenticacao` em `POST /api/clientes` ou manter uma única rota pública de cadastro.
- Reteste: enviar tentativas controladas para as duas rotas e verificar HTTP 429 com `Retry-After`.
- Correção aplicada: `POST /api/clientes` passou a usar o mesmo middleware
  `limitarAutenticacao` da rota principal de cadastro.
- Resultado do reteste (04/09/2026): **APROVADO**; o limite respondeu HTTP 429
  e permaneceu ativo nas tentativas seguintes.

## BUG-002 — `.env.example` do backend ausente

- Área: configuração e entrega.
- Evidência: `backend/.env.example` aparece removido no estado atual do Git.
- Resultado esperado: arquivo seguro e versionado com todas as variáveis obrigatórias, sem valores secretos.
- Impacto: dificulta instalação, homologação e avaliação da BAR-34/BAR-49.
- Correção recomendada: restaurar e atualizar o arquivo com Stripe, webhook, e-mail e WhatsApp.
- Correção aplicada: arquivo restaurado com placeholders das configurações de
  banco, JWT, e-mail, Stripe e WhatsApp, sem credenciais reais.
- Resultado do reteste (04/09/2026): **APROVADO**.

## BUG-003 — Instruções de banco desatualizadas

- Área: documentação.
- Evidência: o README descreve atualização de banco somente até a migration 018; o projeto possui migrations até 026.
- Impacto: uma instalação existente pode ficar sem loja, solicitações de ausência, prazo de pagamento e notificações.
- Correção recomendada: listar a ordem 019–026 e registrar como verificar a aplicação de cada migration.
- Correção aplicada: README atualizado com a sequência completa das migrations
  019 a 026.
- Resultado do reteste (04/09/2026): **APROVADO**.

## MEL-001 — Tamanho do chunk do ExcelJS

- Área: desempenho.
- Evidência: build de produção gerou `exceljs.min` com aproximadamente 929,58 kB e 256,44 kB comprimido.
- Impacto: baixo, porque o relatório é carregado de maneira assíncrona; pode afetar a primeira exportação em conexão lenta.
- Recomendação: manter a importação dinâmica e avaliar uma biblioteca menor somente depois da entrega funcional.

## BUG-004 — Moldura de foco indevida no título do agendamento

- Área: interface do cliente e acessibilidade visual.
- Evidência: `documentos/testes/evidencias/cliente--agendar-1365.png` e
  `cliente-mobile--agendar-390.png`.
- Passos: autenticar como cliente e abrir `/agendar`.
- Resultado esperado: o título da etapa recebe foco programático para leitores
  de tela sem exibir uma moldura que pareça um campo selecionado.
- Resultado atual: uma moldura amarela retangular envolve o título `Serviço`.
- Causa provável: `AgendamentoPage.jsx` chama `focus()` no `h2`, enquanto a
  regra global `:focus-visible` aplica `outline` com `!important`, anulando a
  classe local `outline-none`.
- Impacto: não impede o agendamento, mas prejudica acabamento e hierarquia
  visual em desktop e mobile.
- Correção recomendada: aplicar o estilo global somente a controles
  interativos ou criar uma exceção explícita para o título programaticamente
  focado, preservando a acessibilidade.
- Reteste: abrir cada etapa por teclado, mouse e navegação programática e
  confirmar foco acessível sem moldura indevida no título.
- Correção aplicada: o estilo global de foco foi limitado a elementos
  interativos e deixou de atingir elementos com `tabindex="-1"`.
- Resultado do reteste (04/09/2026): **APROVADO**; o título não exibe a moldura
  e os controles interativos preservam foco visível.

## BUG-005 — Redirecionamento sem aviso de sessão expirada

- Área: autenticação e experiência do cliente.
- Evidência: `documentos/testes/evidencias/cliente-jwt-invalido-login-390.png`
  e `bar46-ui-interacoes-resultados.json`.
- Passos: manter um usuário no armazenamento local com JWT inválido e abrir
  `/dashboard`.
- Resultado esperado: remover a sessão, redirecionar ao login e apresentar uma
  mensagem formal, como “Sua sessão expirou. Entre novamente para continuar.”
- Resultado atual: o token é removido e o redirecionamento funciona, porém a
  tela de login não apresenta nenhuma explicação.
- Impacto: não reduz a proteção da rota, mas pode fazer o cliente interpretar o
  retorno ao login como falha inesperada.
- Correção recomendada: persistir um motivo de logout de uso único em
  `sessionStorage` ou no estado de navegação e exibi-lo como alerta no login.
- Reteste: validar JWT expirado, adulterado e versão revogada, confirmando que a
  mensagem aparece uma única vez e não é exibida em logout voluntário.
- Correção aplicada: respostas 401 em rotas protegidas registram um aviso de uso
  único em `sessionStorage`, encerram a sessão e redirecionam ao login.
- Resultado do reteste (04/09/2026): **APROVADO**; a mensagem formal foi exibida
  uma vez e removida após o consumo.

## Evidência da correção

- Resultado estruturado: `documentos/testes/evidencias/correcoes-bugs/bar46-bugs-reteste-resultados.json`.
- Captura do aviso: `documentos/testes/evidencias/correcoes-bugs/bug-005-sessao-expirada-390.png`.
- Captura do foco: `documentos/testes/evidencias/correcoes-bugs/bug-004-foco-agendamento-390.png`.
- Resultado geral: **6/6 verificações aprovadas e nenhuma reprovação**.
