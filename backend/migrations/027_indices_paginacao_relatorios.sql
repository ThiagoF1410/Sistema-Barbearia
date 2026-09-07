CREATE INDEX IF NOT EXISTS agendamento_cliente_historico_idx
  ON public.agendamento (cliente_idcliente, dataagendamento DESC, horario DESC, idagendamento DESC);

CREATE INDEX IF NOT EXISTS pagamento_data_historico_idx
  ON public.pagamento (datapagamento DESC, idpagamento DESC);

CREATE INDEX IF NOT EXISTS pagamento_status_data_idx
  ON public.pagamento (statuspagamento, datapagamento DESC);
