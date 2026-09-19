-- Normaliza os telefones já gravados para (96) 99123-4567.
--
-- A validação passou a formatar na escrita, mas isso só vale do próximo
-- cadastro em diante. As linhas que já existem foram gravadas cruas, e deixá-
-- las assim criaria dois formatos convivendo na mesma coluna para sempre — a
-- mesma pessoa pareceria dois contatos diferentes numa busca.
--
-- Fixo de 10 dígitos vira (96) 3223-4567: a máscara segue a quantidade de
-- dígitos. Número com contagem diferente de 10 ou 11 fica como está, porque
-- não há formato certo para ele e apagá-lo seria pior.

UPDATE "Aluno" AS a
SET "telefoneResponsavel" = n.formatado
FROM (
  SELECT id,
         CASE length(d)
           WHEN 11 THEN '(' || substr(d, 1, 2) || ') ' || substr(d, 3, 5) || '-' || substr(d, 8, 4)
           WHEN 10 THEN '(' || substr(d, 1, 2) || ') ' || substr(d, 3, 4) || '-' || substr(d, 7, 4)
         END AS formatado
  FROM (
    SELECT id, regexp_replace("telefoneResponsavel", '\D', '', 'g') AS d
    FROM "Aluno"
    WHERE "telefoneResponsavel" IS NOT NULL
  ) AS digitos
) AS n
WHERE a.id = n.id
  AND n.formatado IS NOT NULL
  AND a."telefoneResponsavel" IS DISTINCT FROM n.formatado;

UPDATE "Aluno" AS a
SET "telefoneAluno" = n.formatado
FROM (
  SELECT id,
         CASE length(d)
           WHEN 11 THEN '(' || substr(d, 1, 2) || ') ' || substr(d, 3, 5) || '-' || substr(d, 8, 4)
           WHEN 10 THEN '(' || substr(d, 1, 2) || ') ' || substr(d, 3, 4) || '-' || substr(d, 7, 4)
         END AS formatado
  FROM (
    SELECT id, regexp_replace("telefoneAluno", '\D', '', 'g') AS d
    FROM "Aluno"
    WHERE "telefoneAluno" IS NOT NULL
  ) AS digitos
) AS n
WHERE a.id = n.id
  AND n.formatado IS NOT NULL
  AND a."telefoneAluno" IS DISTINCT FROM n.formatado;
