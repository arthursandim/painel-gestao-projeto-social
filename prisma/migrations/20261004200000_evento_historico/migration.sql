-- Histórico de parâmetros e exceções de turma: capacidade, N de faltas e
-- matrícula acima da capacidade. Só cresce. Lido em /config/historico.

-- CreateEnum
CREATE TYPE "TipoEventoHistorico" AS ENUM ('CAPACIDADE_ALTERADA', 'FALTAS_ALTERADO', 'MATRICULA_ACIMA_CAPACIDADE');

-- CreateTable
CREATE TABLE "EventoHistorico" (
    "id" UUID NOT NULL,
    "tipo" "TipoEventoHistorico" NOT NULL,
    "turmaId" UUID,
    "alunoId" UUID,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "justificativa" TEXT,
    "autorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoHistorico_criadoEm_idx" ON "EventoHistorico"("criadoEm");

-- CreateIndex
CREATE INDEX "EventoHistorico_turmaId_criadoEm_idx" ON "EventoHistorico"("turmaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "EventoHistorico" ADD CONSTRAINT "EventoHistorico_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoHistorico" ADD CONSTRAINT "EventoHistorico_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoHistorico" ADD CONSTRAINT "EventoHistorico_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Recupera as autorizações acima da capacidade já gravadas no cadastro dos
-- alunos (antes deste histórico existir, só o aluno as guardava). A ocupação
-- daquele momento não é conhecida: fica nula.
INSERT INTO "EventoHistorico" ("id", "tipo", "turmaId", "alunoId", "justificativa", "autorId", "criadoEm")
SELECT gen_random_uuid(), 'MATRICULA_ACIMA_CAPACIDADE', "turmaId", "id",
       "autorizacaoAcimaJustificativa", "autorizacaoAcimaPorId",
       COALESCE("autorizacaoAcimaEm", "criadoEm")
FROM "Aluno"
WHERE "acimaCapacidade" = true;
