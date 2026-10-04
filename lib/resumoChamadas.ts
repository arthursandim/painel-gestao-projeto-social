import "server-only";

import { dataParaDia, diaParaData } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export type LinhaChamada = {
  turmaId: string;
  dia: string;
  presentes: number;
  ausentes: number;
};

/**
 * Chamadas fechadas num intervalo de dias, uma linha por (turma, dia), da mais
 * recente para a mais antiga.
 *
 * Sai dos registros de Presenca agrupados — não de um calendário. Dia sem aula
 * não tem registro e não aparece: só "Fechar chamada" faz um dia existir.
 *
 * Fonte única do histórico (/chamada/historico) e das chamadas da semana no
 * painel.
 *
 * `de` inclusive, `ate` exclusive, como dias `AAAA-MM-DD`.
 */
export async function resumoDasChamadas({
  de,
  ate,
  turmaId,
  nomeTurma,
}: {
  de: string;
  ate: string;
  turmaId?: string;
  /** Para desempatar o mesmo dia pela ordem do nome da turma. */
  nomeTurma: ReadonlyMap<string, string>;
}): Promise<LinhaChamada[]> {
  const grupos = await prisma.presenca.groupBy({
    by: ["turmaId", "data", "presente"],
    where: {
      data: { gte: diaParaData(de), lt: diaParaData(ate) },
      ...(turmaId ? { turmaId } : {}),
    },
    _count: { _all: true },
  });

  const porChave = new Map<string, LinhaChamada>();
  for (const g of grupos) {
    const dia = dataParaDia(g.data);
    const chave = `${dia}|${g.turmaId}`;
    const linha = porChave.get(chave) ?? { turmaId: g.turmaId, dia, presentes: 0, ausentes: 0 };
    if (g.presente) linha.presentes += g._count._all;
    else linha.ausentes += g._count._all;
    porChave.set(chave, linha);
  }

  return [...porChave.values()].sort((a, b) =>
    a.dia !== b.dia
      ? a.dia < b.dia ? 1 : -1
      : (nomeTurma.get(a.turmaId) ?? "").localeCompare(nomeTurma.get(b.turmaId) ?? ""),
  );
}
