BEGIN;

DROP VIEW IF EXISTS public.vw_agendamentos_completos;

CREATE VIEW public.vw_agendamentos_completos AS
SELECT
  a.idagendamento,
  a.dataagendamento,
  a.horario,
  a.statusagendamento,
  c.idcliente,
  uc.idusuario AS cliente_usuario_id,
  uc.nome AS cliente,
  uc.email AS cliente_email,
  p.idprofissional,
  up.nome AS profissional,
  p.especialidade,
  s.idservico,
  s.nome AS servico,
  s.duracao,
  s.preco
FROM public.agendamento a
JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
JOIN public.profissional p ON p.idprofissional = a.profissional_idprofissional
JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
JOIN public.servico s ON s.idservico = a.servico_idservico;

COMMIT;
