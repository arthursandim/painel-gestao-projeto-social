// O corte de idade da turma.
//
// LEIA JUNTO COM lib/graduacao.ts. Este arquivo trata do corte dos 12 anos —
// em que turma o aluno treina. O outro trata do corte dos 16 — que escala de
// faixa ele usa. São réguas diferentes e o intervalo entre elas é povoado: o
// aluno de 12 a 15 anos treina em Jovens/Adultos com faixa kids, sem aviso.

/** Aos 12 o aluno já é Jovens/Adultos. Não confunda com IDADE_ESCALA_ADULTA. */
export const IDADE_JOVENS_ADULTOS = 12;

/**
 * Os códigos que o seed grava em Turma.codigo. O código existe para o código-
 * fonte referenciar a turma sem guardar um uuid, e é por ele que o corte de
 * idade se orienta.
 */
export const TURMA_KIDS = "KIDS";
export const TURMA_JOVENS_ADULTOS = "JOVENS_ADULTOS";

/** A turma que a idade indica. */
export function turmaEsperada(idade: number): string {
  return idade < IDADE_JOVENS_ADULTOS ? TURMA_KIDS : TURMA_JOVENS_ADULTOS;
}

/**
 * A idade combina com a turma?
 *
 * Turma que não seja uma das duas do corte não recebe opinião — devolve `true`.
 * Se a diretoria criar uma turma de competição amanhã, o certo é esta função
 * calar, não inventar um aviso sobre uma régua que ninguém definiu para ela.
 */
export function idadeCombinaComTurma(idade: number, codigoTurma: string): boolean {
  if (codigoTurma === TURMA_KIDS) return idade < IDADE_JOVENS_ADULTOS;
  if (codigoTurma === TURMA_JOVENS_ADULTOS) return idade >= IDADE_JOVENS_ADULTOS;
  return true;
}
