// Regras da chamada que não dependem de banco: o dia aceito, o limiar de
// faltas e a contagem de faltas consecutivas.
//
// Ficam aqui, e não na Server Action, para que scripts/verifica-regras.ts as
// confira sem Postgres. A action e a página só leem do banco e chamam estas
// funções.
import { z } from "zod";

import { ehDiaValido, hojeNoProjeto } from "@/lib/data";

/** Chave em Configuracao. O seed cria a linha com "3". */
export const CHAVE_FALTAS_ALERTA = "faltas_consecutivas_alerta";

/**
 * O default não é arbitrário: os termos assinados pelas famílias dizem que três
 * faltas consecutivas ensejam desligamento. O termo fala em desligamento
 * automático; o app só sinaliza.
 */
export const FALTAS_ALERTA_PADRAO = 3;

/**
 * Lê o valor gravado em Configuracao. Linha ausente, vazia ou com lixo cai no
 * default em vez de desligar o alerta — um limiar 0 ou NaN faria todo mundo, ou
 * ninguém, aparecer em risco, e nenhum dos dois é percebido como erro.
 */
export function limiarFaltas(valor: string | null | undefined): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : FALTAS_ALERTA_PADRAO;
}

export type RegistroPresenca = { data: string; presente: boolean };

/**
 * Faltas consecutivas mais recentes: a partir do registro mais novo, conta as
 * ausências até a primeira presença.
 *
 * É SEQUÊNCIA, não soma. Falta, vem, falta, falta dá 2, não 3.
 *
 * Conta os registros do próprio aluno, em qualquer turma — decisão do
 * desenvolvedor na fase 6. Dia sem aula não tem registro, então não quebra nem
 * soma; chamada em que o aluno não estava na lista também não. Trocar de turma
 * não zera a sequência, porque os registros acompanham o aluno.
 *
 * Ordena por conta própria: quem chama não precisa lembrar da ordem, e uma
 * consulta que esquecesse o `orderBy` daria um número plausível e errado.
 */
export function faltasConsecutivas(registros: readonly RegistroPresenca[]): number {
  const ordenados = [...registros].sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0,
  );
  let faltas = 0;
  for (const r of ordenados) {
    if (r.presente) break;
    faltas++;
  }
  return faltas;
}

export function emRiscoDeEvasao(faltas: number, limiar: number): boolean {
  return faltas >= limiar;
}

export type SituacaoDia =
  | { ok: true; retroativo: boolean }
  | { ok: false; erro: string };

/**
 * O dia escolhido para a chamada.
 *
 * Futuro é bloqueado aqui, no servidor — o `max` do input é conveniência, não
 * regra. Retroativo passa, e a tela mostra aviso.
 *
 * `hoje` é o dia no fuso do projeto. O servidor da Vercel roda em UTC: entre
 * 21h e meia-noite local, `new Date()` já está no dia seguinte, e uma chamada
 * das 21h30 seria gravada com a data de amanhã.
 */
export function situacaoDoDia(dia: string, hoje: string = hojeNoProjeto()): SituacaoDia {
  if (!ehDiaValido(dia)) return { ok: false, erro: "Data inválida." };
  if (dia > hoje) return { ok: false, erro: "Não é possível lançar chamada em data futura." };
  return { ok: true, retroativo: dia < hoje };
}

/**
 * O que o formulário manda ao fechar.
 *
 * `alunoId` é a lista que a pessoa VIU na tela; `ausente`, os que ela marcou.
 * Mandar a lista vista, e não só os ausentes, é o que impede que um aluno
 * matriculado entre o abrir e o fechar da chamada seja gravado como presente
 * sem ninguém ter olhado para o nome dele.
 */
export const esquemaChamada = z
  .object({
    turmaId: z.uuid({ error: "Turma inválida." }),
    data: z.string().refine(ehDiaValido, "Data inválida."),
    alunoId: z.array(z.uuid()).min(1, "Nenhum aluno na chamada."),
    ausente: z.array(z.uuid()),
  })
  .refine((v) => v.ausente.every((id) => v.alunoId.includes(id)), {
    message: "Ausente fora da lista da chamada.",
  });

export type DadosChamada = z.infer<typeof esquemaChamada>;
