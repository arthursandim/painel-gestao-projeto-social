// Parâmetros editáveis em /config/parametros: a capacidade de cada turma e o N
// de faltas consecutivas que dispara o alerta de evasão.
//
// Fica fora da Server Action para que scripts/verifica-regras.ts confira as
// faixas sem Postgres.
import { z } from "zod";

/**
 * Faixa do N de faltas, decidida pelo desenvolvedor na fase 7. Abaixo de 1 o
 * alerta pegaria todo mundo; acima de 10 já não avisa a tempo de nada.
 */
export const FALTAS_MINIMO = 1;
export const FALTAS_MAXIMO = 10;

/** Teto só contra erro de digitação (400 em vez de 40). */
export const CAPACIDADE_MINIMA = 1;
export const CAPACIDADE_MAXIMA = 200;

function inteiroEntre(campo: string, min: number, max: number) {
  return z.coerce
    .number({ error: `${campo}: informe um número.` })
    .int({ error: `${campo}: informe um número inteiro.` })
    .min(min, { error: `${campo}: o mínimo é ${min}.` })
    .max(max, { error: `${campo}: o máximo é ${max}.` });
}

export const esquemaFaltas = inteiroEntre(
  "Faltas consecutivas",
  FALTAS_MINIMO,
  FALTAS_MAXIMO,
);

export function esquemaCapacidade(nomeTurma: string) {
  return inteiroEntre(
    `Capacidade de ${nomeTurma}`,
    CAPACIDADE_MINIMA,
    CAPACIDADE_MAXIMA,
  );
}

/**
 * Campo vazio vira 0 no `z.coerce.number()` e passaria como "número" — por isso
 * o vazio é barrado antes, com a mensagem certa.
 */
export function lerInteiro<T extends z.ZodType>(
  esquema: T,
  valor: FormDataEntryValue | null,
): z.ZodSafeParseResult<z.infer<T>> {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return esquema.safeParse(texto === "" ? undefined : texto) as z.ZodSafeParseResult<
    z.infer<T>
  >;
}

/**
 * Capacidade abaixo da ocupação é PERMITIDA (decisão do desenvolvedor na fase
 * 7): ninguém é desligado, a turma só passa a aparecer acima do limite no
 * painel. A tela avisa antes de salvar, e o aviso é este texto.
 */
export function avisoCapacidadeAbaixo(
  nome: string,
  capacidade: number,
  ativos: number,
): string | null {
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade >= ativos) {
    return null;
  }
  return `${nome} tem ${ativos} alunos ativos. Com capacidade ${capacidade}, a turma passa a aparecer acima do limite (${ativos}/${capacidade}). Ninguém é desligado.`;
}
