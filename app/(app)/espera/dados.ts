import "server-only";

import { prisma } from "@/lib/prisma";

/** Turmas oferecidas na lista de espera: as ativas, na ordem das outras telas. */
export function turmasDaEspera() {
  return prisma.turma.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, codigo: true, nome: true },
  });
}
