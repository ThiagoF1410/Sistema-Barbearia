-- Um profissional não pode ter dois agendamentos ativos no mesmo horário inicial.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamento_profissional_data_horario_ativo
  ON public.agendamento (profissional_idprofissional, dataagendamento, horario)
  WHERE statusagendamento <> 'CANCELADO';
