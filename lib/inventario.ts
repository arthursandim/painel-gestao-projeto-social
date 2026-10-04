import "server-only";

import { Prisma, StatusAluno, StatusEmprestimo } from "@prisma/client";

import { dataParaDia, hojeNoProjeto } from "@/lib/data";
import { CONTAGEM_ZERADA, contagensPorItem, type Contagem } from "@/lib/estoque";
import { prisma } from "@/lib/prisma";
import {
  alunoParaEmprestimo,
  SELECAO_EMPRESTIMO,
  type AlunoEmprestimo,
} from "@/lib/selecaoAluno";

type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * Total, disponível e emprestado de vários itens com duas consultas, não uma
 * por item. Sem `itemIds`, de todos.
 */
export async function contagensDosItens(
  itemIds?: readonly string[],
  cliente: Cliente = prisma,
): Promise<Map<string, Contagem>> {
  const filtro = itemIds ? { itemId: { in: [...itemIds] } } : {};
  const [movimentos, emprestimos] = await Promise.all([
    cliente.movimentoEstoque.groupBy({
      by: ["itemId", "tipo"],
      where: filtro,
      _sum: { quantidade: true },
    }),
    cliente.emprestimo.groupBy({
      by: ["itemId"],
      where: { ...filtro, status: StatusEmprestimo.EMPRESTADO },
      _count: { _all: true },
    }),
  ]);
  return contagensPorItem(
    movimentos.map((m) => ({ itemId: m.itemId, tipo: m.tipo, quantidade: m._sum.quantidade ?? 0 })),
    emprestimos.map((e) => ({ itemId: e.itemId, quantidade: e._count._all })),
  );
}

export async function contagemDoItem(itemId: string, cliente: Cliente = prisma): Promise<Contagem> {
  return (await contagensDosItens([itemId], cliente)).get(itemId) ?? CONTAGEM_ZERADA;
}

/**
 * Trava a linha do item até o fim da transação.
 *
 * Toda escrita que depende do saldo ou dos empréstimos abertos — emprestar,
 * dar saída, desativar, desmarcar "pode ser emprestado" — passa por aqui antes
 * de conferir. Assim duas operações no mesmo item entram em fila: dois
 * empréstimos simultâneos não levam a mesma unidade, e uma desativação não
 * passa no meio de um empréstimo. Devolve false se o item não existe.
 */
export async function travarItem(tx: Prisma.TransactionClient, itemId: string): Promise<boolean> {
  const linhas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Item" WHERE id = ${itemId}::uuid FOR UPDATE`;
  return linhas.length > 0;
}

/** Categorias já usadas, para as sugestões do campo (texto livre). */
export async function categoriasUsadas(): Promise<string[]> {
  const linhas = await prisma.item.findMany({
    where: { categoria: { not: null } },
    distinct: ["categoria"],
    orderBy: { categoria: "asc" },
    select: { categoria: true },
  });
  return linhas.flatMap((l) => (l.categoria ? [l.categoria] : []));
}

export type EmprestimoTela = {
  id: string;
  status: StatusEmprestimo;
  dataEmprestimo: string;
  dataDevolucao: string | null;
  observacao: string | null;
  emprestadoPor: string | null;
  recebidoPor: string | null;
  aluno: AlunoEmprestimo;
  item: { id: string; descricao: string; identificacao: string | null };
};

/**
 * Empréstimos já na forma da tela. O aluno sai pela projeção do inventário
 * (lib/selecaoAluno.ts): o registro cru, com nome dos pais e nascimento, não
 * passa daqui. Abertos primeiro, depois os mais recentes.
 */
export async function emprestimosParaTela(
  where: Prisma.EmprestimoWhereInput,
): Promise<EmprestimoTela[]> {
  const hoje = hojeNoProjeto();
  const registros = await prisma.emprestimo.findMany({
    where,
    orderBy: [{ dataEmprestimo: "desc" }, { criadoEm: "desc" }],
    select: {
      id: true,
      status: true,
      dataEmprestimo: true,
      dataDevolucao: true,
      observacao: true,
      emprestadoPor: { select: { nome: true } },
      recebidoPor: { select: { nome: true } },
      aluno: { select: SELECAO_EMPRESTIMO },
      item: { select: { id: true, descricao: true, identificacao: true } },
    },
  });
  return registros
    .map((r) => ({
      id: r.id,
      status: r.status,
      dataEmprestimo: dataParaDia(r.dataEmprestimo),
      dataDevolucao: r.dataDevolucao ? dataParaDia(r.dataDevolucao) : null,
      observacao: r.observacao,
      emprestadoPor: r.emprestadoPor?.nome ?? null,
      recebidoPor: r.recebidoPor?.nome ?? null,
      aluno: alunoParaEmprestimo(r.aluno, hoje),
      item: r.item,
    }))
    .sort(
      (a, b) =>
        Number(b.status === StatusEmprestimo.EMPRESTADO) -
        Number(a.status === StatusEmprestimo.EMPRESTADO),
    );
}

/** Alunos oferecidos no empréstimo: só ativos, e só nome, matrícula e turma. */
export async function alunosParaEmprestar(): Promise<
  { id: string; nome: string; matricula: string; turma: string }[]
> {
  const registros = await prisma.aluno.findMany({
    where: { status: StatusAluno.ATIVO },
    orderBy: { nome: "asc" },
    select: SELECAO_EMPRESTIMO,
  });
  const hoje = hojeNoProjeto();
  return registros.map((r) => {
    const { id, nome, matricula, turma } = alunoParaEmprestimo(r, hoje);
    return { id, nome, matricula, turma };
  });
}
