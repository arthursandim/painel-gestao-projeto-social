-- CreateEnum
CREATE TYPE "TipoSanguineo" AS ENUM ('A_POSITIVO', 'A_NEGATIVO', 'B_POSITIVO', 'B_NEGATIVO', 'AB_POSITIVO', 'AB_NEGATIVO', 'O_POSITIVO', 'O_NEGATIVO');

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "alergias" TEXT,
ADD COLUMN     "medicamentosContinuos" TEXT,
ADD COLUMN     "problemasSaude" TEXT,
ADD COLUMN     "tipoSanguineo" "TipoSanguineo";
