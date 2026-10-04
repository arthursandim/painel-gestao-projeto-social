-- Autor da última alteração do item (descrição, estado, emprestável, ativo).

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "atualizadoPorId" UUID;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

