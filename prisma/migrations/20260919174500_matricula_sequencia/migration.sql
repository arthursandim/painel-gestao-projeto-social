-- Sequence da matrícula do aluno.
--
-- Não está em schema.prisma porque o Prisma não modela sequence avulsa; o
-- schema continua vendo apenas `matricula String @unique`, que é a garantia
-- final. A sequence é só a geradora, e é ela que faz dois cadastros simultâneos
-- receberem números diferentes sem combinar nada entre si.
--
-- Fora de transação por natureza: `nextval` não volta atrás num rollback. É
-- justamente isso que impede a colisão, ao preço de buracos na numeração — que
-- em identificador não significam nada.

CREATE SEQUENCE IF NOT EXISTS "Aluno_matricula_seq" AS bigint INCREMENT BY 1 START WITH 1;

-- Posiciona a sequence depois da maior matrícula que já exista, para o dia em
-- que os 80 cadastros de papel forem digitados com matrícula própria. Com a
-- tabela vazia, o próximo valor é 1 e o primeiro aluno recebe A0001.
--
-- `is_called = false` faz o próximo nextval devolver exatamente este valor, em
-- vez do seguinte.
SELECT setval(
  '"Aluno_matricula_seq"',
  COALESCE(
    (SELECT MAX(substring("matricula" FROM 2)::bigint)
       FROM "Aluno"
      WHERE "matricula" ~ '^A[0-9]+$'),
    0
  ) + 1,
  false
);
