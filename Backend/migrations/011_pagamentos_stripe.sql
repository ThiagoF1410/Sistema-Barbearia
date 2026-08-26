CREATE TABLE IF NOT EXISTS public.pagamento (
  idpagamento BIGSERIAL PRIMARY KEY,
  agendamento_idagendamento INTEGER NOT NULL UNIQUE
    REFERENCES public.agendamento(idagendamento) ON DELETE CASCADE,
  datapagamento DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  statuspagamento VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
    CHECK (statuspagamento IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU')),
  metodo VARCHAR(30) NOT NULL DEFAULT 'STRIPE',
  moeda CHAR(3) NOT NULL DEFAULT 'brl',
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pagamento_status_idx
  ON public.pagamento (statuspagamento);

CREATE INDEX IF NOT EXISTS pagamento_checkout_session_idx
  ON public.pagamento (stripe_checkout_session_id);
