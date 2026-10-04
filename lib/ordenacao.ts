// Ordenação das listas por coluna (pedido do desenvolvedor em 2026-10-04).
//
// A ordem vai na URL (`?ordem=graduacao&dir=desc`), como os filtros: o link
// guardado abre igual e o voltar do navegador funciona. A ordenação é feita no
// servidor, em memória — as listas são pequenas (80 alunos, poucas centenas de
// itens) e algumas colunas nem existem no banco (idade, saldo, disponível).
//
// Puro, para scripts/verifica-regras.ts conferir.
import { EstadoConservacao, type Graduacao } from "@prisma/client";

import { GRADUACOES_POR_ESCALA } from "@/lib/graduacao";

export type Direcao = "asc" | "desc";
export type Ordem<C extends string> = { campo: C; dir: Direcao };

/** Lê `ordem` e `dir` da URL; coluna desconhecida cai no padrão. */
export function lerOrdem<C extends string>(
  params: Record<string, string | string[] | undefined>,
  colunas: readonly C[],
  padrao: Ordem<C>,
): Ordem<C> {
  const campo = colunas.find((c) => c === params.ordem);
  if (!campo) return padrao;
  return { campo, dir: params.dir === "desc" ? "desc" : "asc" };
}

/**
 * A URL do cabeçalho: mesma coluna inverte a direção, outra coluna começa
 * crescente. Os filtros que já estão na URL são mantidos.
 */
export function urlDaOrdem(
  caminho: string,
  params: Record<string, string | string[] | undefined>,
  atual: Ordem<string>,
  campo: string,
): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (chave === "ordem" || chave === "dir" || typeof valor !== "string" || valor === "") continue;
    busca.set(chave, valor);
  }
  busca.set("ordem", campo);
  busca.set("dir", atual.campo === campo && atual.dir === "asc" ? "desc" : "asc");
  return `${caminho}?${busca.toString()}`;
}

/**
 * Posição da faixa na progressão da IBJJF, nunca a ordem alfabética: todas as
 * kids na ordem (Branca → … → Verde-Preta) e depois as adultas (Branca → Azul
 * → Roxa → Marrom → Preta). Kids antes de adulto porque é a ordem em que o
 * aluno passa por elas.
 */
const PROGRESSAO: readonly Graduacao[] = [
  ...GRADUACOES_POR_ESCALA.KIDS,
  ...GRADUACOES_POR_ESCALA.ADULTO,
];

/** Faixa e grau num número só: a faixa manda, o grau desempata. */
export function posicaoDaGraduacao(graduacao: Graduacao, grau: number): number {
  return PROGRESSAO.indexOf(graduacao) * 10 + grau;
}

/** Estado de conservação do melhor para o pior, não por ordem alfabética. */
const ORDEM_ESTADO: readonly EstadoConservacao[] = [
  EstadoConservacao.NOVO,
  EstadoConservacao.BOM,
  EstadoConservacao.REGULAR,
  EstadoConservacao.RUIM,
  EstadoConservacao.INSERVIVEL,
];

export function posicaoDoEstado(estado: EstadoConservacao): number {
  return ORDEM_ESTADO.indexOf(estado);
}

const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

type Valor = string | number | null | undefined;

/**
 * Compara dois valores de coluna. Texto em ordem do português (acento e
 * maiúscula não separam "Álvaro" de "alvaro"); vazio sempre no fim, nas duas
 * direções — célula sem dado não deve subir para o topo ao inverter.
 */
export function compararValores(a: Valor, b: Valor, dir: Direcao): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  const base =
    typeof a === "number" && typeof b === "number" ? a - b : COLADOR.compare(String(a), String(b));
  return dir === "asc" ? base : -base;
}

/**
 * Ordena por uma chave, com desempate estável por uma segunda (normalmente o
 * nome), sempre crescente — empate não embaralha ao inverter a coluna.
 */
export function ordenarPor<T>(
  lista: readonly T[],
  chave: (item: T) => Valor,
  dir: Direcao,
  desempate: (item: T) => Valor,
): T[] {
  return [...lista].sort(
    (a, b) =>
      compararValores(chave(a), chave(b), dir) ||
      compararValores(desempate(a), desempate(b), "asc"),
  );
}
