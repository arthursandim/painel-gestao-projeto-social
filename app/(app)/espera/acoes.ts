"use server";

import { StatusListaEspera } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPapeis } from "@/lib/auth";
import { diaParaData } from "@/lib/data";
import {
  camposEsperaDoForm,
  esquemaEspera,
  esquemaRemocaoEspera,
  type DadosEspera,
} from "@/lib/esquemaEspera";
import { papeisDaRota } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export type EstadoEspera = { erro?: string; ok?: string };

/** Quem abre /espera escreve nela: ADMIN e INSCRICOES. Mesma fonte do menu. */
const PAPEIS_ESPERA = papeisDaRota("/espera");

function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

/** A turma vem do formulário: confere que existe e está ativa. */
async function turmaValida(turmaId: string): Promise<boolean> {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, ativa: true },
    select: { id: true },
  });
  return turma !== null;
}

function paraBanco(dados: DadosEspera) {
  return {
    ...dados,
    nascimento: diaParaData(dados.nascimento),
    dataEntrada: diaParaData(dados.dataEntrada),
  };
}

export async function criarEspera(
  _estado: EstadoEspera,
  form: FormData,
): Promise<EstadoEspera> {
  const autor = await exigirPapeis(PAPEIS_ESPERA);

  const analise = esquemaEspera.safeParse(camposEsperaDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  if (!(await turmaValida(analise.data.turmaPretendidaId))) {
    return { erro: "Turma pretendida não encontrada." };
  }

  await prisma.listaEspera.create({
    data: {
      ...paraBanco(analise.data),
      criadoPorId: autor.id,
      atualizadoPorId: autor.id,
    },
  });

  revalidatePath("/espera");
  redirect("/espera");
}

/**
 * Edição: só enquanto aguarda. Convertido ou removido é histórico — o registro
 * guarda o que foi informado na época (decisão da fase 7: a espera guarda o
 * original, o aluno é a fonte da verdade dali em diante).
 */
export async function editarEspera(
  _estado: EstadoEspera,
  form: FormData,
): Promise<EstadoEspera> {
  const autor = await exigirPapeis(PAPEIS_ESPERA);

  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Registro inválido." };

  const analise = esquemaEspera.safeParse(camposEsperaDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  if (!(await turmaValida(analise.data.turmaPretendidaId))) {
    return { erro: "Turma pretendida não encontrada." };
  }

  // O status vai no WHERE: se alguém converteu ou removeu entre abrir e salvar,
  // nada é escrito.
  const { count } = await prisma.listaEspera.updateMany({
    where: { id: id.data, status: StatusListaEspera.AGUARDANDO },
    data: { ...paraBanco(analise.data), atualizadoPorId: autor.id },
  });
  if (count === 0) {
    return { erro: "Este registro não está mais aguardando — já foi convertido ou removido." };
  }

  revalidatePath("/espera");
  redirect("/espera");
}

/** Saída da fila sem conversão. Nada é apagado: muda o status e guarda o motivo. */
export async function removerDaEspera(
  _estado: EstadoEspera,
  form: FormData,
): Promise<EstadoEspera> {
  const autor = await exigirPapeis(PAPEIS_ESPERA);

  const analise = esquemaRemocaoEspera.safeParse({
    id: form.get("id"),
    motivo: form.get("motivo"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };

  const { count } = await prisma.listaEspera.updateMany({
    where: { id: analise.data.id, status: StatusListaEspera.AGUARDANDO },
    data: {
      status: StatusListaEspera.REMOVIDO,
      removidoEm: new Date(),
      removidoPorId: autor.id,
      motivoRemocao: analise.data.motivo,
    },
  });
  if (count === 0) {
    return { erro: "Este registro não está mais aguardando — já foi convertido ou removido." };
  }

  revalidatePath("/espera");
  return { ok: "Removido da fila. O registro continua consultável em Removidos." };
}
