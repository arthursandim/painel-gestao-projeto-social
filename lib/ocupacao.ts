import "server-only";

import { StatusAluno } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type OcupacaoTurma = {
  id: string;
  nome: string;
  capacidade: number;
  ativos: number;
  acima: boolean;
};

/**
 * Ocupação de cada turma ativa contra a capacidade configurada.
 *
 * Conta só alunos ATIVOS: desligado libera a vaga. Uma consulta agrupada, não
 * uma por turma. `acima` é estritamente maior — 40/40 é cheia, 41/40 é a
 * exceção autorizada que o painel destaca.
 */
export async function ocupacaoDasTurmas(): Promise<OcupacaoTurma[]> {
  const [turmas, contagem] = await Promise.all([
    prisma.turma.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, capacidade: true },
    }),
    prisma.aluno.groupBy({
      by: ["turmaId"],
      where: { status: StatusAluno.ATIVO },
      _count: { _all: true },
    }),
  ]);

  const ativosPorTurma = new Map(contagem.map((c) => [c.turmaId, c._count._all]));

  return turmas.map((t) => {
    const ativos = ativosPorTurma.get(t.id) ?? 0;
    return { ...t, ativos, acima: ativos > t.capacidade };
  });
}
