"use server";

import { type Prisma, StatusEmprestimo, TipoMovimento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPapeis } from "@/lib/auth";
import { diaParaData, hojeNoProjeto } from "@/lib/data";
import {
  camposItemDoForm,
  decidirComEmprestimoAberto,
  esquemaItem,
  esquemaItemNovo,
  MOTIVO_CADASTRO,
} from "@/lib/estoque";
import { travarItem } from "@/lib/inventario";
import { ehAdmin, papeisDaRota } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export type EstadoItem = { erro?: string; ok?: string };

/** Quem abre /inventario escreve nele: ADMIN e INVENTARIO. Mesma fonte do menu. */
const PAPEIS_INVENTARIO = papeisDaRota("/inventario");

function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

function emprestimosAbertos(tx: Prisma.TransactionClient, itemId: string) {
  return tx.emprestimo.count({ where: { itemId, status: StatusEmprestimo.EMPRESTADO } });
}

/**
 * Cadastro. A quantidade informada não é coluna do item: vira o primeiro
 * movimento de ENTRADA, na mesma transação — se o movimento falhar, o item não
 * nasce sem saldo.
 */
export async function criarItem(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaItemNovo.safeParse(camposItemDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { quantidade, ...dados } = analise.data;

  const item = await prisma.$transaction(async (tx) => {
    const criado = await tx.item.create({
      data: { ...dados, criadoPorId: autor.id, atualizadoPorId: autor.id },
      select: { id: true },
    });
    await tx.movimentoEstoque.create({
      data: {
        itemId: criado.id,
        tipo: TipoMovimento.ENTRADA,
        quantidade,
        motivo: MOTIVO_CADASTRO,
        data: diaParaData(hojeNoProjeto()),
        autorId: autor.id,
      },
    });
    return criado;
  });

  revalidatePath("/inventario");
  redirect(`/inventario/${item.id}`);
}

/**
 * Edição: tudo menos a quantidade, que só muda por movimento — para todos,
 * inclusive o admin. Desmarcar "pode ser emprestado" com empréstimo em aberto é
 * barrado para INVENTARIO e permitido ao ADMIN (decisão da fase 8).
 */
export async function editarItem(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Item inválido." };

  const analise = esquemaItem.safeParse(camposItemDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };

  const resultado = await prisma.$transaction(async (tx): Promise<EstadoItem> => {
    // A trava fecha a janela entre conferir os empréstimos e gravar: um
    // empréstimo novo no mesmo item espera esta transação terminar.
    if (!(await travarItem(tx, id.data))) return { erro: "Item não encontrado." };

    const atual = await tx.item.findUniqueOrThrow({
      where: { id: id.data },
      select: { podeSerEmprestado: true },
    });
    if (atual.podeSerEmprestado && !analise.data.podeSerEmprestado) {
      const decisao = decidirComEmprestimoAberto(
        "desmarcarEmprestavel",
        await emprestimosAbertos(tx, id.data),
        ehAdmin(autor.papeis),
      );
      if (decisao && "erro" in decisao) return decisao;
    }

    await tx.item.update({
      where: { id: id.data },
      data: { ...analise.data, atualizadoPorId: autor.id },
    });
    return {};
  });
  if (resultado.erro) return resultado;

  revalidatePath("/inventario");
  redirect(`/inventario/${id.data}`);
}

const esquemaAtivo = z.object({
  id: z.uuid({ error: "Item inválido." }),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/**
 * Desativar e reativar. Nada é apagado: o item inativo sai da lista padrão e
 * não recebe empréstimo nem movimento, mas o histórico continua.
 */
export async function alterarAtivoItem(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaAtivo.safeParse({ id: form.get("id"), ativo: form.get("ativo") });
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { id, ativo } = analise.data;

  const resultado = await prisma.$transaction(async (tx): Promise<EstadoItem> => {
    if (!(await travarItem(tx, id))) return { erro: "Item não encontrado." };

    if (!ativo) {
      const decisao = decidirComEmprestimoAberto(
        "desativar",
        await emprestimosAbertos(tx, id),
        ehAdmin(autor.papeis),
      );
      if (decisao && "erro" in decisao) return decisao;
    }

    await tx.item.update({ where: { id }, data: { ativo, atualizadoPorId: autor.id } });
    return { ok: ativo ? "Item reativado." : "Item desativado. O histórico continua consultável." };
  });

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${id}`);
  return resultado;
}
