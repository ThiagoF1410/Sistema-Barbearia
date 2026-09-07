# BAR-48 — Validação no Chrome e Edge

## Situação

**CONCLUÍDA em 04/09/2026.**

O sistema foi validado com a mesma matriz no Google Chrome e no Microsoft
Edge. Foram executadas **228 verificações**, todas aprovadas.

## Navegadores

| Navegador | Versão validada | Renderização | Interações | Reprovações |
|---|---:|---:|---:|---:|
| Google Chrome for Testing | 152.0.7977.82 | 101/101 | 13/13 | 0 |
| Microsoft Edge | 152.0.4191.62 | 101/101 | 13/13 | 0 |
| **Total** | — | **202/202** | **26/26** | **0** |

O Chrome for Testing é a distribuição oficial do Google destinada a testes
reproduzíveis. O executável temporário não faz parte dos arquivos de entrega.

## Cobertura de renderização

Foram percorridas 25 rotas em cada navegador nas seguintes resoluções:

- celular: 360 × 800 px;
- tablet: 768 × 1024 px;
- notebook: 1366 × 768 px;
- desktop: 1920 × 1080 px.

As rotas incluem páginas públicas, área do cliente, painel profissional e área
administrativa. Um cenário adicional abriu o menu administrativo em 360 × 800
px, totalizando 101 verificações por navegador.

Cada cenário verificou:

- rota correta e conteúdo renderizado;
- término do estado de carregamento;
- ausência de mensagem técnica exposta;
- presença da configuração de viewport;
- ausência de overflow horizontal global;
- ausência de controles parcialmente fora da tela.

## Interações validadas

Os 13 casos interativos foram repetidos nos dois navegadores e incluíram:

- proteção e redirecionamento de rotas administrativas;
- página segura para rota inexistente;
- item ativo único no menu administrativo;
- calendário em primeiro plano no viewport móvel;
- abas da loja e operações da sacola;
- estados vazio e preenchido do dashboard;
- filtros do histórico;
- logout e encerramento de sessão inválida;
- mensagem formal durante falha de comunicação simulada.

## Conferência visual amostral

Foram inspecionadas capturas do menu administrativo móvel, fluxo de
agendamento do cliente e pagamentos administrativos no Chrome. Não foram
observados cortes, sobreposições impeditivas ou diferenças funcionais em
relação ao Edge.

## Evidências

- Chrome: `documentos/testes/evidencias/bar48/chrome/`;
- Edge: `documentos/testes/evidencias/bar48/edge/`;
- resultados Chrome: `bar48-chrome-resultados.json` e
  `interacoes/bar48-chrome-interacoes-resultados.json`;
- resultados Edge: `bar48-edge-resultados.json` e
  `interacoes/bar48-edge-interacoes-resultados.json`;
- executor de rotas: `backend/scripts/bar47-responsividade-smoke.js`;
- executor de interações: `backend/scripts/bar46-ui-interacoes.js`.

## Ocorrência no roteiro de teste

Na primeira rodada interativa do Chrome, o caso de falha de rede foi marcado
como reprovado porque o simulador ainda bloqueava somente a porta antiga 5173.
O endereço do simulador foi corrigido para acompanhar dinamicamente a origem
do frontend. A rodada completa foi repetida e terminou com 13/13 aprovações.
Essa ocorrência pertencia ao roteiro de automação e não caracterizou defeito na
aplicação.

## Conclusão

Chrome e Edge apresentaram comportamento equivalente nos cenários avaliados.
Não há incompatibilidade aberta entre os dois navegadores, portanto a
**BAR-48 está concluída**.
