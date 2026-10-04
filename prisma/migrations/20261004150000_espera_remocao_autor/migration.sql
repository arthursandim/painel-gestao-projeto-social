-- Saída da fila sem conversão (quem, quando, motivo) e autor da última edição
-- do registro da lista de espera.

-- AlterTable
ALTER TABLE "ListaEspera" ADD COLUMN     "atualizadoPorId" UUID,
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoEm" TIMESTAMP(3),
ADD COLUMN     "removidoPorId" UUID;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_removidoPorId_fkey" FOREIGN KEY ("removidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
