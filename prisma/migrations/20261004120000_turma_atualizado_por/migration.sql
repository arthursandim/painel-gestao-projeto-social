-- Autor da última alteração da turma (capacidade editada em /config/parametros).

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "atualizadoPorId" UUID;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
