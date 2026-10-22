-- Ficha assinada entregue em papel: qual variante, quando e quem marcou.
-- Só aditiva: colunas novas, todas opcionais.

-- CreateEnum
CREATE TYPE "VarianteFicha" AS ENUM ('MENOR', 'ADULTO');

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "fichaEntregueEm" TIMESTAMP(3),
ADD COLUMN     "fichaEntreguePorId" UUID,
ADD COLUMN     "fichaEntregueVariante" "VarianteFicha";

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_fichaEntreguePorId_fkey" FOREIGN KEY ("fichaEntreguePorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
