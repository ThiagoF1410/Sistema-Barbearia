# Sprint 6 — Testes e entrega final

**Atualizado em:** 04/09/2026

| Ticket | Entrega | Status | Evidência |
| --- | --- | --- | --- |
| BAR-46 | Testes manuais dos fluxos | Concluída | `testes/BAR-46-relatorio-execucao.md` |
| BAR-47 | Responsividade em diferentes resoluções | Concluída | `testes/BAR-47-relatorio-responsividade.md` |
| BAR-48 | Chrome e Edge | Concluída | `testes/BAR-48-relatorio-navegadores.md` |
| BAR-49 | bcrypt, JWT, ambiente e rotas | Concluída | `testes/BAR-49-relatorio-seguranca.md` |
| BAR-50 | Registro e correção de bugs | Concluída | `testes/BAR-46-registro-bugs.md` e evidências de reteste |
| BAR-51 | Atualização da documentação | Concluída | `testes/BAR-51-relatorio-documentacao.md` |
| BAR-52 | Deploy em homologação | Pendente | será executada após o fechamento da BAR-51 |

## Resultados consolidados

- Backend: 75 testes automatizados aprovados.
- BAR-46: fluxos manuais concluídos e bugs registrados/retestados.
- BAR-47: 101 verificações responsivas aprovadas.
- BAR-48: 228 verificações de renderização e interação aprovadas entre Chrome e Edge.
- BAR-49: 12 ataques controlados aprovados e 0 vulnerabilidades no `npm audit` dos dois projetos.
- Build de produção e lint do frontend aprovados.

## Pendências para homologação

1. Definir URLs públicas do frontend e backend.
2. Provisionar o banco de homologação e aplicar migrações 000 a 026 em ordem.
3. Configurar variáveis privadas no provedor, sem enviar arquivos `.env`.
4. Configurar o destino HTTPS do webhook Stripe em modo de teste.
5. Definir armazenamento persistente para a sessão Baileys ou deixar o WhatsApp desabilitado até a conexão supervisionada.
6. Executar um smoke final no endereço publicado.
7. Registrar URL, data, versão e aprovação do orientador na evidência da BAR-52.

## Critério de encerramento da BAR-51

- README compatível com o estado atual.
- Ambiente backend/frontend documentado.
- Arquitetura, perfis e principais regras registrados.
- Endpoints organizados por domínio e permissão.
- Guias Stripe, WhatsApp, testes e migrações interligados.
- Links e comandos revisados.

Todos os critérios foram atendidos. O verificador reproduzível confirmou 71/71 rotas da API documentadas e nenhum link local ausente no README.
