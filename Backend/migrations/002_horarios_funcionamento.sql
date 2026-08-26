CREATE TABLE IF NOT EXISTS public.horario_funcionamento (
  idhorario SERIAL PRIMARY KEY,
  dia_semana SMALLINT NOT NULL UNIQUE CHECK (dia_semana BETWEEN 0 AND 6),
  hora_abertura TIME,
  hora_fechamento TIME,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT horario_valido CHECK (
    (ativo = FALSE AND hora_abertura IS NULL AND hora_fechamento IS NULL)
    OR
    (ativo = TRUE AND hora_abertura IS NOT NULL AND hora_fechamento IS NOT NULL
      AND hora_abertura < hora_fechamento)
  )
);

INSERT INTO public.horario_funcionamento
  (dia_semana, hora_abertura, hora_fechamento, ativo)
VALUES
  (0, NULL, NULL, FALSE),
  (1, '09:00', '19:30', TRUE),
  (2, '09:00', '19:30', TRUE),
  (3, '09:00', '19:30', TRUE),
  (4, '09:00', '19:30', TRUE),
  (5, '09:00', '19:30', TRUE),
  (6, '08:00', '15:00', TRUE)
ON CONFLICT (dia_semana) DO NOTHING;
