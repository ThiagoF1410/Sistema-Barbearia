BEGIN;

-- A grade de início permanece fixa a cada 30 minutos. A duração abaixo define
-- apenas quanto tempo o atendimento bloqueia na agenda do profissional.
WITH duracoes(nome, minutos) AS (
  VALUES
    ('Simples', 30),
    ('Navalhado', 30),
    ('Degradê', 30),
    ('Nudred', 30),
    ('Combo simples', 60),
    ('Combo degradê', 60),
    ('Combo navalhado/nudred', 60),
    ('Pezinho', 15),
    ('Barba', 30),
    ('Barba com pigmentação', 30),
    ('Alisamento', 60),
    ('Corte taper', 30),
    ('Corte tesoura', 30),
    ('Platinado sem corte', 90),
    ('Luzes sem corte', 90),
    ('Riscos diversos', 15)
)
UPDATE public.servico servico
SET duracao = duracoes.minutos
FROM duracoes
WHERE servico.tipo = 'servico'
  AND LOWER(BTRIM(servico.nome)) = LOWER(duracoes.nome);

COMMIT;
