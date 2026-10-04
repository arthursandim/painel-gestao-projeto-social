import "server-only";

import { Prisma, StatusEmprestimo } from "@prisma/client";

import { CONTAGEM_ZERADA, contagensPorItem, type Contagem } from "@/lib/estoque";
import { prisma } from "@/lib/prisma";

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
