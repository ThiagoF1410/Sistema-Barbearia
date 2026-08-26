# O Rei da Navalha

Sistema web para gerenciamento de agendamentos da barbearia O Rei da Navalha (TCC).

## Execução local

1. Copie `backend/.env.example` para `backend/.env` e preencha as credenciais.
2. Em um banco vazio, execute em ordem todos os arquivos de `backend/migrations`,
   começando por `000_schema_base.sql`. Em um banco já existente, não execute a
   baseline `000` retroativamente; aplique somente as migrações ainda pendentes.
3. No diretório `backend`, execute `npm install` e `npm run dev`.
4. No diretório `frontend`, execute `npm install` e `npm run dev`.

O backend usa a porta 3001 e o frontend usa a porta 5173 por padrão.

### Atualização do banco Neon já existente

Para aplicar as correções desta versão no banco atual, execute no SQL Editor,
na ordem:

1. `014_consolidar_pagamentos_e_faturamento.sql`;
2. `015_disponibilidade_profissional.sql`;
3. `016_revogacao_tokens_e_recuperacao.sql`;
4. `017_snapshot_servico_agendamento.sql`;
5. `018_limpeza_indices.sql`.

Não execute `000_schema_base.sql` no Neon atual. A migração 016 invalida os
tokens JWT antigos de forma intencional; depois dela, entre novamente no sistema.

Para validar o backend, execute `npm test`. No frontend, use `npm run lint` e
`npm run build`.

## Stripe e ambientes

- Desenvolvimento e homologação usam `STRIPE_MODE=test` com uma chave `sk_test_`.
- Produção real usa `STRIPE_MODE=live` com uma chave `sk_live_`.
- O segredo do webhook começa com `whsec_` e só deve ser configurado após criar o destino na Stripe.
- Nunca envie os arquivos `.env` ao repositório.
- Em `NODE_ENV=production`, `FRONTEND_URL` deve usar HTTPS e a API rejeita conexões HTTP.
- Em desenvolvimento, `http://localhost:5173` continua permitido.

Provedores de hospedagem normalmente encerram o TLS no proxy. O backend confia em um proxy em produção e reconhece o cabeçalho `X-Forwarded-Proto: https`.
