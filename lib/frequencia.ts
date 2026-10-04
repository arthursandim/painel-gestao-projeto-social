import "server-only";

import {
  CHAVE_FALTAS_ALERTA,
  faltasConsecutivas,
  limiarFaltas,
  ultimaPresenca,
  type RegistroPresenca,
} from "@/lib/chamada";
import { dataParaDia } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export type Frequencia = {
  /** Sequência atual de faltas — sequência, não soma. */
  faltas: number;
  ultimaPresenca: string | null;
};

const SEM_REGISTRO: Frequencia = { faltas: 0, ultimaPresenca: null };

/**
 * Faltas consecutivas e última presença de vários alunos com UMA consulta de
 * Presenca, e o cálculo em memória — nunca uma consulta por aluno. São ~80
 * alunos; o histórico inteiro cabe folgado.
 *
 * `ate` limita o histórico (a chamada de um dia retroativo não pode contar
 * registros posteriores a ele). Sem `ate`, vale tudo o que foi gravado.
 *
 * Única definição: a chamada, a lista de alunos e o painel leem daqui, então o
 * selo de um e o card do outro não têm como discordar.
 */
export async function frequenciaDosAlunos(
  alunoIds: readonly string[],
  ate?: Date,
): Promise<Map<string, Frequencia>> {
  const resultado = new Map<string, Frequencia>();
  if (alunoIds.length === 0) return resultado;

  const historico = await prisma.presenca.findMany({
    where: {
      alunoId: { in: [...alunoIds] },
      ...(ate ? { data: { lte: ate } } : {}),
    },
    select: { alunoId: true, data: true, presente: true },
  });

  const porAluno = new Map<string, RegistroPresenca[]>();
  for (const h of historico) {
    const lista = porAluno.get(h.alunoId) ?? [];
    lista.push({ data: dataParaDia(h.data), presente: h.presente });
    porAluno.set(h.alunoId, lista);
  }

  for (const id of alunoIds) {
    const registros = porAluno.get(id);
    resultado.set(
      id,
      registros
        ? { faltas: faltasConsecutivas(registros), ultimaPresenca: ultimaPresenca(registros) }
        : SEM_REGISTRO,
    );
  }
  return resultado;
}

/** O N configurado em /config/parametros, com fallback 3. */
export async function lerLimiarFaltas(): Promise<number> {
  const config = await prisma.configuracao.findUnique({
    where: { chave: CHAVE_FALTAS_ALERTA },
    select: { valor: true },
  });
  return limiarFaltas(config?.valor);
}
