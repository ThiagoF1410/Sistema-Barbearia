BEGIN;

ALTER TABLE public.pagamento
  ADD COLUMN IF NOT EXISTS checkout_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expirado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS pagamento_online_expiracao_idx
  ON public.pagamento (checkout_expira_em, idpagamento)
  WHERE metodo = 'STRIPE' AND statuspagamento = 'PENDENTE';

COMMENT ON COLUMN public.pagamento.checkout_expira_em IS
  'Prazo autoritativo do servidor para concluir o pagamento on-line.';

COMMENT ON COLUMN public.pagamento.expirado_em IS
  'Instante em que o pagamento pendente foi encerrado por expiração.';

COMMIT;
