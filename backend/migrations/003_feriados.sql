CREATE TABLE IF NOT EXISTS public.feriado (
  idferiado SERIAL PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  origem VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('api', 'manual')),
  modo_funcionamento VARCHAR(20) NOT NULL DEFAULT 'fechado'
    CHECK (modo_funcionamento IN ('fechado', 'horario_normal', 'horario_especial', 'ignorar')),
  hora_abertura TIME,
  hora_fechamento TIME,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feriado_horario_especial_valido CHECK (
    modo_funcionamento <> 'horario_especial'
    OR (
      hora_abertura IS NOT NULL
      AND hora_fechamento IS NOT NULL
      AND hora_abertura < hora_fechamento
    )
  )
);
