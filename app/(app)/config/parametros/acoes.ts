"use server";

import { Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth";
import { CHAVE_FALTAS_ALERTA } from "@/lib/chamada";
import { esquemaCapacidade, esquemaFaltas, lerInteiro } from "@/lib/parametros";
import { prisma } from "@/lib/prisma";

export type EstadoParametros = { erro?: string; ok?: string };

/**
 * Grava a capacidade de cada turma e o N de faltas. Só admin — a guarda está
 * aqui, não só no layout de /config, porque Server Action é endpoint público.
 *
 * Só o que mudou é escrito: autor e timestamp têm que dizer quem mexeu naquele
 * valor, e salvar a tela sem mudar nada não pode trocar o autor de todos.
 *
 * Capacidade abaixo da ocupação passa (decisão da fase 7). Ninguém é desligado;
 * a turma só aparece acima do limite no painel.
 */
export async function salvarParametros(
  _estado: EstadoParametros,
  form: FormData,
): Promise<EstadoParametros> {
  const autor = await exigirPapeis([Papel.ADMIN]);

  const faltas = lerInteiro(esquemaFaltas, form.get("faltas"));
  if (!faltas.success) return { erro: faltas.error.issues[0].message };

  // A lista de turmas vem do banco, não do formulário: um id forjado no
  // FormData não tem como alcançar uma turma inativa ou inexistente.
  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    select: { id: true, nome: true, capacidade: true },
  });

  const capacidades: { id: string; capacidade: number }[] = [];
  for (const turma of turmas) {
    const r = lerInteiro(esquemaCapacidade(turma.nome), form.get(`capacidade_${turma.id}`));
    if (!r.success) return { erro: r.error.issues[0].message };
    if (r.data !== turma.capacidade) capacidades.push({ id: turma.id, capacidade: r.data });
  }

  const atual = await prisma.configuracao.findUnique({
    where: { chave: CHAVE_FALTAS_ALERTA },
    select: { valor: true },
  });
  const faltasMudou = atual?.valor !== String(faltas.data);

  if (capacidades.length === 0 && !faltasMudou) {
    return { ok: "Nada mudou." };
  }

  await prisma.$transaction([
    ...capacidades.map((c) =>
      prisma.turma.update({
        where: { id: c.id },
        data: { capacidade: c.capacidade, atualizadoPorId: autor.id },
      }),
    ),
    ...(faltasMudou
      ? [
          prisma.configuracao.upsert({
            where: { chave: CHAVE_FALTAS_ALERTA },
            update: { valor: String(faltas.data), atualizadoPorId: autor.id },
            create: {
              chave: CHAVE_FALTAS_ALERTA,
              valor: String(faltas.data),
              descricao:
                "Faltas consecutivas que colocam o aluno no card de risco de evasão.",
              atualizadoPorId: autor.id,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/config/parametros");
  revalidatePath("/painel");
  return { ok: "Parâmetros salvos." };
}
