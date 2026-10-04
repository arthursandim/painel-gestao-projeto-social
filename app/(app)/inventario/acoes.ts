"use server";

import { type Prisma, StatusEmprestimo, TipoMovimento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPapeis } from "@/lib/auth";
import { dataParaDia, diaParaData, hojeNoProjeto } from "@/lib/data";
import {
  camposItemDoForm,
  decidirComEmprestimoAberto,
  erroDeDataDeRetorno,
  erroDeEmprestimo,
  erroDeSaida,
  esquemaDevolucao,
  esquemaEmprestimo,
  esquemaItem,
  esquemaItemNovo,
  esquemaMovimento,
  esquemaPerda,
  motivoDaPerda,
  MOTIVO_CADASTRO,
} from "@/lib/estoque";
import { contagemDoItem, travarItem } from "@/lib/inventario";
import { ehAdmin, papeisDaRota } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { alunoParaEmprestimo, SELECAO_EMPRESTIMO } from "@/lib/selecaoAluno";

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

/**
 * Entrada ou saída de estoque. É o único caminho pelo qual o total muda — a
 * correção de saldo também é um movimento, com motivo.
 */
export async function registrarMovimento(
  _estado: EstadoItem,
  form: FormData,
): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaMovimento.safeParse({
    itemId: form.get("itemId"),
    tipo: form.get("tipo"),
    quantidade: form.get("quantidade"),
    data: form.get("data"),
    motivo: form.get("motivo"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { itemId, tipo, quantidade, data, motivo } = analise.data;

  const resultado = await prisma.$transaction(async (tx): Promise<EstadoItem> => {
    // Saldo conferido com a linha travada: duas saídas simultâneas não levam
    // juntas mais do que existe, nem uma saída leva a unidade que um empréstimo
    // acabou de reservar.
    if (!(await travarItem(tx, itemId))) return { erro: "Item não encontrado." };

    const item = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { ativo: true },
    });
    if (!item.ativo) return { erro: "Item inativo não recebe movimento. Reative antes." };

    if (tipo === TipoMovimento.SAIDA) {
      const erro = erroDeSaida(quantidade, await contagemDoItem(itemId, tx));
      if (erro) return { erro };
    }

    await tx.movimentoEstoque.create({
      data: { itemId, tipo, quantidade, motivo, data: diaParaData(data), autorId: autor.id },
    });
    return {
      ok: `${tipo === TipoMovimento.ENTRADA ? "Entrada" : "Saída"} de ${quantidade} registrada.`,
    };
  });

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${itemId}`);
  return resultado;
}

/**
 * Empresta uma unidade a um aluno ativo. Não gera movimento de estoque: o item
 * continua no total, só deixa de estar disponível.
 */
export async function emprestar(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaEmprestimo.safeParse({
    itemId: form.get("itemId"),
    alunoId: form.get("alunoId"),
    data: form.get("data"),
    observacao: form.get("observacao"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { itemId, alunoId, data, observacao } = analise.data;

  const resultado = await prisma.$transaction(async (tx): Promise<EstadoItem> => {
    // Com a linha travada, o segundo empréstimo simultâneo da unidade única
    // espera o primeiro gravar e então encontra o disponível já em 0.
    if (!(await travarItem(tx, itemId))) return { erro: "Item não encontrado." };

    const [item, registro, c] = await Promise.all([
      tx.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { ativo: true, podeSerEmprestado: true },
      }),
      tx.aluno.findUnique({ where: { id: alunoId }, select: SELECAO_EMPRESTIMO }),
      contagemDoItem(itemId, tx),
    ]);
    const aluno = registro ? alunoParaEmprestimo(registro, hojeNoProjeto()) : null;
    const erro = erroDeEmprestimo(item, c, aluno);
    if (erro || !aluno) return { erro: erro ?? "Aluno não encontrado." };

    await tx.emprestimo.create({
      data: {
        itemId,
        alunoId,
        dataEmprestimo: diaParaData(data),
        emprestadoPorId: autor.id,
        observacao,
      },
    });
    return { ok: `Emprestado a ${aluno.nome} (${aluno.matricula}).` };
  });

  revalidatePath("/inventario", "layout");
  return resultado;
}

/** Devolução: data e quem recebeu. O status vai no WHERE — devolver duas vezes não passa. */
export async function devolver(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaDevolucao.safeParse({
    emprestimoId: form.get("emprestimoId"),
    data: form.get("data"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { emprestimoId, data } = analise.data;

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id: emprestimoId },
    select: { dataEmprestimo: true },
  });
  if (!emprestimo) return { erro: "Empréstimo não encontrado." };
  const erroData = erroDeDataDeRetorno(data, dataParaDia(emprestimo.dataEmprestimo));
  if (erroData) return { erro: erroData };

  const { count } = await prisma.emprestimo.updateMany({
    where: { id: emprestimoId, status: StatusEmprestimo.EMPRESTADO },
    data: {
      status: StatusEmprestimo.DEVOLVIDO,
      dataDevolucao: diaParaData(data),
      recebidoPorId: autor.id,
    },
  });
  if (count === 0) return { erro: "Este empréstimo já foi encerrado — devolvido ou marcado como perdido." };

  revalidatePath("/inventario", "layout");
  return { ok: "Devolução registrada." };
}

/**
 * Perda. Duas escritas na mesma transação: o empréstimo deixa de ser
 * EMPRESTADO e uma SAIDA de 1 tira a unidade do total. Uma sem a outra
 * desconta duas vezes (SAIDA com o status ainda EMPRESTADO) ou deixa o total
 * inflado (PERDIDO sem SAIDA). Quem marcou e quando ficam na SAIDA.
 */
export async function marcarPerdido(_estado: EstadoItem, form: FormData): Promise<EstadoItem> {
  const autor = await exigirPapeis(PAPEIS_INVENTARIO);

  const analise = esquemaPerda.safeParse({
    emprestimoId: form.get("emprestimoId"),
    data: form.get("data"),
    detalhe: form.get("detalhe"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const { emprestimoId, data, detalhe } = analise.data;

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id: emprestimoId },
    select: { itemId: true, dataEmprestimo: true, aluno: { select: { matricula: true } } },
  });
  if (!emprestimo) return { erro: "Empréstimo não encontrado." };
  const erroData = erroDeDataDeRetorno(data, dataParaDia(emprestimo.dataEmprestimo));
  if (erroData) return { erro: erroData };

  const resultado = await prisma.$transaction(async (tx): Promise<EstadoItem> => {
    await travarItem(tx, emprestimo.itemId);

    const { count } = await tx.emprestimo.updateMany({
      where: { id: emprestimoId, status: StatusEmprestimo.EMPRESTADO },
      data: { status: StatusEmprestimo.PERDIDO },
    });
    if (count === 0) {
      return { erro: "Este empréstimo já foi encerrado — devolvido ou marcado como perdido." };
    }

    await tx.movimentoEstoque.create({
      data: {
        itemId: emprestimo.itemId,
        tipo: TipoMovimento.SAIDA,
        quantidade: 1,
        motivo: motivoDaPerda(emprestimo.aluno.matricula, detalhe),
        data: diaParaData(data),
        autorId: autor.id,
      },
    });
    return { ok: "Marcado como perdido. A unidade saiu do total." };
  });

  revalidatePath("/inventario", "layout");
  return resultado;
}
