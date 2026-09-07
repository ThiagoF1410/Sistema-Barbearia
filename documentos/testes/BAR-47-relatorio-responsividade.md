# BAR-47 — Relatório de responsividade

## Situação

**CONCLUÍDA em 04/09/2026.**

Foram executados 101 cenários responsivos, com **101 aprovações e nenhuma reprovação** na rodada final válida.

## Objetivo

Validar as telas públicas e autenticadas do sistema em diferentes dimensões de viewport, verificando a adaptação entre celular, tablet, notebook e desktop.

## Resoluções testadas

| Perfil de tela | Resolução |
| --- | ---: |
| Celular compacto | 360 × 800 px |
| Tablet | 768 × 1024 px |
| Notebook | 1366 × 768 px |
| Desktop Full HD | 1920 × 1080 px |

## Cobertura

As 25 rotas abaixo foram verificadas nas quatro resoluções, totalizando 100 cenários. Um cenário adicional validou o menu administrativo aberto no celular.

### Páginas públicas

- `/inicio`
- `/login`
- `/cadastro`
- `/esqueci-senha`
- `/resetar-senha`
- `/termos`
- `/privacidade`

### Área do cliente

- `/dashboard`
- `/servicos`
- `/loja`
- `/sacola`
- `/agendar`
- `/historico`
- `/perfil`
- `/checkout/sucesso`
- `/checkout/cancelado`

### Área profissional

- `/profissional`

### Área administrativa

- `/admin`
- `/admin/servicos`
- `/admin/agenda`
- `/admin/agendamentos`
- `/admin/pagamentos`
- `/admin/profissionais`
- `/admin/clientes`
- `/admin/relatorios`

## Critérios de aprovação

Cada cenário somente foi aprovado quando apresentou simultaneamente:

- rota esperada após a navegação;
- documento carregado e conteúdo efetivamente renderizado;
- ausência de estado de carregamento pendente;
- ausência de mensagem técnica exposta ao usuário;
- configuração `viewport` compatível com dispositivos móveis;
- ausência de rolagem horizontal global;
- ausência de controles parcialmente cortados fora da área visível.

Controles dentro de regiões horizontais explicitamente roláveis, como abas em telas estreitas, foram reconhecidos como comportamento responsivo válido. A rolagem vertical foi permitida.

## Resultado consolidado

| Indicador | Resultado |
| --- | ---: |
| Cenários executados | 101 |
| Aprovados | 101 |
| Reprovados | 0 |
| Rotas verificadas | 25 |
| Resoluções por rota | 4 |
| Capturas geradas | 101 |

O menu lateral administrativo também foi aberto em 360 × 800 px e permaneceu integralmente dentro do viewport, sem gerar overflow horizontal e com camada de fundo adequada.

## Conferência visual amostral

Além das verificações programáticas, foram inspecionadas capturas representativas das áreas com maior densidade de conteúdo:

- histórico e loja do cliente em 360 × 800 px;
- agenda administrativa e menu lateral aberto em 360 × 800 px;
- pagamentos administrativos em 768 × 1024 px;
- painel profissional em 360 × 800 px e 768 × 1024 px;
- relatório administrativo em 1366 × 768 px;
- dashboard do cliente em 1920 × 1080 px.

Não foram identificados textos essenciais cortados, sobreposição impeditiva, conteúdo vazio, controles inacessíveis ou perda de função nessas amostras.

## Evidências

- Resultado estruturado: `documentos/testes/evidencias/bar47/bar47-resultados.json`
- Capturas de tela: `documentos/testes/evidencias/bar47/*.png`
- Script reproduzível: `backend/scripts/bar47-responsividade-smoke.js`
- Logs da execução final: `documentos/testes/evidencias/bar47/backend-final.log` e `frontend-final.log`

## Observação de usabilidade

O diagnóstico também registra controles com dimensão visual inferior a 32 px. A maior parte corresponde a links textuais e elementos auxiliares e não causou corte, sobreposição ou perda de acesso. Essa métrica fica disponível no JSON para uma futura auditoria específica de acessibilidade e ergonomia; ela não constitui reprovação da responsividade prevista na BAR-47.

## Conclusão

A aplicação mantém a estrutura, o conteúdo e os controles utilizáveis nas quatro faixas avaliadas. Não há defeito responsivo aberto decorrente desta execução. Com a matriz integral aprovada e as evidências armazenadas, a **BAR-47 está concluída**.

