import "server-only";

import { StatusAluno, type Papel } from "@prisma/client";

import { diaParaData } from "@/lib/data";
import { frequenciaDosAlunos, lerLimiarFaltas } from "@/lib/frequencia";
import { prisma } from "@/lib/prisma";
import { selectAlunoPara } from "@/lib/selecaoAluno";

export type AlunoNaChamada = {
  id: string;
  matricula: string;
  nome: string;
  /** Valor gravado, ou `true` numa chamada nova — todos presentes por default. */
  presente: boolean;
  /** Sequência atual até o dia da chamada, inclusive. */
  faltas: number;
};

export type Lancamento = {
  porNome: string | null;
  em: Date;
  /** Última alteração depois do primeiro fechamento, se houve. */
  alteracao: { porNome: string | null; em: Date } | null;
};

export type Chamada = {
  alunos: AlunoNaChamada[];
  /** Null quando a chamada ainda não foi fechada. */
  lancamento: Lancamento | null;
  /** Ativos da turma que já têm presença em outra turma neste dia. */
  emOutraTurma: number;
  limiar: number;
};

/**
 * Quem está na chamada de uma turma num dia. Única definição — a página mostra
 * e a action grava a partir daqui, então as duas não têm como divergir.
 *
 * Chamada já fechada: exatamente quem foi lançado nela, e só os que continuam
 * ativos. Aluno matriculado depois não é encaixado em chamada antiga, porque
 * ganharia presença num dia em que não era aluno (decisão do desenvolvedor na
 * fase 6).
 *
 * Chamada nova, de hoje ou retroativa: os ativos da turma hoje — não há outra
 * fonte. Não filtra pela data de cadastro: a importação gravou os alunos que já
 * estavam no papel com a data do dia da importação.
 *
 * Em ambos os casos, aluno que já tem registro em OUTRA turma no mesmo dia fica
 * fora. O unique é (aluno, data), não (aluno, turma, data): gravar aqui
 * sobrescreveria a presença da outra turma.
 */
export async function carregarChamada(
  turmaId: string,
  dia: string,
  papeis: readonly Papel[],
): Promise<Chamada> {
  const data = diaParaData(dia);

  const [gravados, limiar] = await Promise.all([
    prisma.presenca.findMany({
      where: { turmaId, data },
      select: {
        alunoId: true,
        presente: true,
        criadoEm: true,
        atualizadoEm: true,
        registradoPor: { select: { nome: true } },
      },
    }),
    lerLimiarFaltas(),
  ]);

  const fechada = gravados.length > 0;

  // Toda leitura de Aluno passa pelo seletor único, mesmo que a chamada só
  // use nome e matrícula: o que sai daqui é o que o papel pode ver.
  const select = selectAlunoPara(papeis);
  const candidatos = await prisma.aluno.findMany({
    where: fechada
      ? { id: { in: gravados.map((g) => g.alunoId) }, status: StatusAluno.ATIVO }
      : { turmaId, status: StatusAluno.ATIVO },
    orderBy: { nome: "asc" },
    select,
  });

  let emOutraTurma = 0;
  let alunos = candidatos;
  if (!fechada && candidatos.length > 0) {
    const ocupados = await prisma.presenca.findMany({
      where: {
        alunoId: { in: candidatos.map((a) => a.id) },
        data,
        turmaId: { not: turmaId },
      },
      select: { alunoId: true },
    });
    const fora = new Set(ocupados.map((o) => o.alunoId));
    emOutraTurma = fora.size;
    alunos = candidatos.filter((a) => !fora.has(a.id));
  }

  const frequencia = await frequenciaDosAlunos(
    alunos.map((a) => a.id),
    data,
  );

  const gravadoPor = new Map(gravados.map((g) => [g.alunoId, g.presente]));

  return {
    alunos: alunos.map((a) => ({
      id: a.id,
      matricula: a.matricula,
      nome: a.nome,
      presente: gravadoPor.get(a.id) ?? true,
      faltas: frequencia.get(a.id)?.faltas ?? 0,
    })),
    lancamento: fechada ? resumirLancamento(gravados) : null,
    emOutraTurma,
    limiar,
  };
}

type Gravado = {
  criadoEm: Date;
  atualizadoEm: Date;
  registradoPor: { nome: string } | null;
};

/**
 * Quem lançou e quando.
 *
 * Refechar só reescreve as linhas que mudaram, então uma linha intocada guarda
 * quem fechou primeiro, e a de `atualizadoEm` mais recente guarda quem alterou
 * por último. A margem de um minuto separa as duas coisas: as linhas criadas no
 * mesmo fechamento têm carimbos a milissegundos de distância.
 */
function resumirLancamento(gravados: Gravado[]): Lancamento {
  const primeiro = gravados.reduce((a, b) =>
    b.criadoEm < a.criadoEm ||
    (b.criadoEm.getTime() === a.criadoEm.getTime() && b.atualizadoEm < a.atualizadoEm)
      ? b
      : a,
  );
  const ultimo = gravados.reduce((a, b) => (b.atualizadoEm > a.atualizadoEm ? b : a));

  const alterada = ultimo.atualizadoEm.getTime() - primeiro.criadoEm.getTime() > 60_000;

  return {
    porNome: primeiro.registradoPor?.nome ?? null,
    em: primeiro.criadoEm,
    alteracao: alterada
      ? { porNome: ultimo.registradoPor?.nome ?? null, em: ultimo.atualizadoEm }
      : null,
  };
}
