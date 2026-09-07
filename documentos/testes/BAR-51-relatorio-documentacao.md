# BAR-51 — Atualização da documentação

**Data:** 04/09/2026  
**Status:** concluída

## Escopo realizado

- README reestruturado com funcionalidades, tecnologias, pré-requisitos, instalação e execução.
- Procedimento de banco novo e atualização segura de banco existente.
- Tabela completa das variáveis de ambiente do backend e frontend.
- Configuração local e hospedada do Stripe, incluindo webhook e retorno em rede local.
- Referência à sessão privada e persistente do Baileys.
- Política atual de senhas, JWT, CORS, HTTPS e proteção de rotas.
- Arquitetura, responsabilidades, perfis e fluxos de negócio documentados.
- Referência da API organizada por domínio, método e permissão.
- Status e evidências da Sprint 6 consolidados.
- `WHATSAPP_SESSION_DIR` incluída em `backend/.env.example`.

## Arquivos principais

| Documento | Conteúdo |
| --- | --- |
| `README.md` | entrada do projeto, instalação, integrações e validação |
| `documentos/ARQUITETURA-E-FLUXOS.md` | componentes, perfis e regras de negócio |
| `documentos/API.md` | índice de endpoints e permissões |
| `documentos/SPRINT-6-STATUS.md` | andamento e evidências da entrega final |
| `backend/WHATSAPP.md` | operação da integração Baileys |
| `backend/.env.example` | contrato de configuração sem valores privados |

## Verificação

Foi adicionado `backend/scripts/bar51-docs-check.js`, que compara as declarações das rotas Express com a referência da API e valida os links locais do README.

Resultado final:

```json
{
  "rotasVerificadas": 71,
  "rotasAusentesNaDocumentacao": [],
  "linksReadmeAusentes": []
}
```

Também foi executado `git diff --check` nos arquivos documentais, sem erros de formatação.

## Conclusão

**BAR-51 está concluída.** A documentação representa a versão atual do sistema e oferece instruções suficientes para instalação, avaliação, testes e preparação da homologação.
