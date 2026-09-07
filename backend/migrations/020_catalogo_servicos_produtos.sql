BEGIN;

-- Consolida o nome legado antes de inserir o catálogo. A condição evita
-- duplicidade caso a migração seja executada mais de uma vez.
UPDATE public.servico legado
SET nome = 'Combo navalhado/nudred',
    duracao = 60,
    preco = 50.00,
    descricao = 'Corte navalhado ou nudred combinado com acabamento de barba.'
WHERE legado.tipo = 'servico'
  AND LOWER(BTRIM(legado.nome)) = 'combo navalhado'
  AND NOT EXISTS (
    SELECT 1
    FROM public.servico atual
    WHERE atual.tipo = 'servico'
      AND LOWER(BTRIM(atual.nome)) = 'combo navalhado/nudred'
  );

WITH catalogo(nome, tipo, duracao, preco, descricao) AS (
  VALUES
    ('Simples', 'servico', 30, 25.00, 'Corte tradicional com acabamento.'),
    ('Navalhado', 'servico', 30, 35.00, 'Corte com acabamento navalhado.'),
    ('Degradê', 'servico', 30, 30.00, 'Corte degradê com acabamento.'),
    ('Nudred', 'servico', 30, 35.00, 'Modelagem nudred com acabamento.'),
    ('Combo simples', 'servico', 60, 40.00, 'Corte simples e barba.'),
    ('Combo degradê', 'servico', 60, 45.00, 'Corte degradê e barba.'),
    ('Combo navalhado/nudred', 'servico', 60, 50.00, 'Corte navalhado ou nudred combinado com acabamento de barba.'),
    ('Pezinho', 'servico', 15, 12.00, 'Acabamento do contorno do cabelo.'),
    ('Barba', 'servico', 30, 25.00, 'Modelagem e acabamento da barba.'),
    ('Barba com pigmentação', 'servico', 45, 30.00, 'Modelagem da barba com aplicação de pigmentação.'),
    ('Alisamento', 'servico', 60, 40.00, 'Alisamento capilar com finalização.'),
    ('Corte taper', 'servico', 30, 28.00, 'Corte taper com acabamento.'),
    ('Corte tesoura', 'servico', 45, 30.00, 'Corte realizado predominantemente com tesoura.'),
    ('Platinado sem corte', 'servico', 120, 140.00, 'Procedimento de platinado sem corte.'),
    ('Luzes sem corte', 'servico', 90, 100.00, 'Aplicação de luzes sem corte.'),
    ('Riscos diversos', 'servico', 15, 10.00, 'Desenhos e riscos personalizados no corte.'),
    ('Pomada modeladora', 'produto', 1, 35.00, 'Pomada para modelagem e fixação dos cabelos.'),
    ('Cera modeladora', 'produto', 1, 30.00, 'Cera de acabamento com fixação flexível.'),
    ('Óleo para barba', 'produto', 1, 32.00, 'Óleo hidratante para barba e pele.'),
    ('Balm para barba', 'produto', 1, 35.00, 'Balm hidratante e modelador para barba.'),
    ('Shampoo para cabelo e barba', 'produto', 1, 30.00, 'Limpeza suave para cabelo e barba.'),
    ('Pente de madeira', 'produto', 1, 18.00, 'Pente de madeira para cabelo e barba.')
), atualizados AS (
  UPDATE public.servico servico
  SET duracao = catalogo.duracao,
      preco = catalogo.preco,
      descricao = catalogo.descricao
  FROM catalogo
  WHERE servico.tipo = catalogo.tipo
    AND LOWER(BTRIM(servico.nome)) = LOWER(catalogo.nome)
  RETURNING servico.idservico
)
INSERT INTO public.servico (nome, tipo, duracao, preco, descricao)
SELECT catalogo.nome, catalogo.tipo, catalogo.duracao, catalogo.preco, catalogo.descricao
FROM catalogo
WHERE NOT EXISTS (
  SELECT 1
  FROM public.servico existente
  WHERE existente.tipo = catalogo.tipo
    AND LOWER(BTRIM(existente.nome)) = LOWER(catalogo.nome)
);

COMMIT;
