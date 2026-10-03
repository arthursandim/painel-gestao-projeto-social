"use server";

import { revalidatePath } from "next/cache";

import { carregarChamada } from "./dados";
import { exigirPapeis } from "@/lib/auth";
import { esquemaChamada, situacaoDoDia } from "@/lib/chamada";
import { diaParaData } from "@/lib/data";
import { papeisDaRota } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export type EstadoChamada = { erro?: string; ok?: string };

/**
 * Fecha a chamada gravando TODOS — presentes e ausentes — para que a contagem
 * de faltas consecutivas nunca precise inferir ausência pela falta de linha.
 *
 * Refazer atualiza, nunca duplica: o unique (aluno, data) e o upsert garantem.
 * Só as linhas que mudaram são reescritas, e é isso que deixa a trilha de quem
 * alterou o quê legível: uma linha intocada continua com o autor original.
 *
 * Duas pessoas fechando ao mesmo tempo: o upsert vira INSERT … ON CONFLICT no
 * Postgres, então nenhuma das duas duplica e a última a gravar vence.
 */
export async function fecharChamada(
  _anterior: EstadoChamada,
  formData: FormData,
): Promise<EstadoChamada> {
  const usuario = await exigirPapeis(papeisDaRota("/chamada"));

  const parse = esquemaChamada.safeParse({
    turmaId: formData.get("turmaId"),
    data: formData.get("data"),
    alunoId: formData.getAll("alunoId"),
    ausente: formData.getAll("ausente"),
  });
  if (!parse.success) {
    return { erro: parse.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { turmaId, data: dia, alunoId, ausente } = parse.data;

  // A data futura é barrada aqui. O `max` do campo de data é só conveniência.
  const situacao = situacaoDoDia(dia);
  if (!situacao.ok) return { erro: situacao.erro };

  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, ativa: true },
    select: { id: true },
  });
  if (!turma) return { erro: "Turma não encontrada." };

  // A lista que vale é a do servidor, interceptada com a que a pessoa viu.
  // Quem foi matriculado depois de a tela abrir fica de fora até ela recarregar
  // — melhor do que gravá-lo presente sem ninguém ter olhado o nome.
  const chamada = await carregarChamada(turmaId, dia, usuario.papeis);
  const vistos = new Set(alunoId);
  const alvos = chamada.alunos.filter((a) => vistos.has(a.id));
  if (alvos.length === 0) {
    return { erro: "A lista mudou desde que a tela abriu. Recarregue e confira." };
  }

  const ausentes = new Set(ausente);
  const data = diaParaData(dia);

  const existentes = await prisma.presenca.findMany({
    where: { alunoId: { in: alvos.map((a) => a.id) }, data },
    select: { alunoId: true, presente: true },
  });
  const atual = new Map(existentes.map((e) => [e.alunoId, e.presente]));

  const operacoes = alvos
    .map((a) => ({ alunoId: a.id, presente: !ausentes.has(a.id) }))
    .filter((r) => atual.get(r.alunoId) !== r.presente)
    .map((r) =>
      prisma.presenca.upsert({
        where: { alunoId_data: { alunoId: r.alunoId, data } },
        create: {
          alunoId: r.alunoId,
          turmaId,
          data,
          presente: r.presente,
          registradoPorId: usuario.id,
        },
        update: { presente: r.presente, registradoPorId: usuario.id },
      }),
    );

  if (operacoes.length > 0) {
    await prisma.$transaction(operacoes);
  }

  revalidatePath("/chamada");

  const nAusentes = alvos.filter((a) => ausentes.has(a.id)).length;
  const resumo = `${alvos.length - nAusentes} presentes, ${nAusentes} ausentes.`;
  if (operacoes.length === 0) return { ok: `Nada mudou. ${resumo}` };
  return {
    ok:
      existentes.length === 0
        ? `Chamada fechada: ${resumo}`
        : `Chamada atualizada (${operacoes.length} ${operacoes.length === 1 ? "alteração" : "alterações"}): ${resumo}`,
  };
}
