// A escala de graduação e o corte de idade que a decide.
//
// LEIA JUNTO COM lib/turma.ts. São dois cortes de idade diferentes e confundi-
// los é o erro mais fácil de cometer neste projeto:
//
//   turma   → Kids até 11a11m29d. Aos 12 já é Jovens/Adultos.
//   escala  → Kids até 15 anos.   Aos 16 passa para a escala adulta.
//
// O aluno de 12 a 15 anos treina em Jovens/Adultos usando faixa da escala kids.
// Isso é normal e não gera aviso nenhum.
import { Graduacao } from "@prisma/client";

import { idadeHoje } from "@/lib/data";

export type Escala = "KIDS" | "ADULTO";

/** Aos 16 a escala vira adulta. Não confunda com IDADE_JOVENS_ADULTOS. */
export const IDADE_ESCALA_ADULTA = 16;

export const GRAU_MINIMO = 0;
export const GRAU_MAXIMO = 4;

export const ROTULO_ESCALA: Record<Escala, string> = {
  KIDS: "Kids",
  ADULTO: "Adulto",
};

export const DESCRICAO_ESCALA: Record<Escala, string> = {
  KIDS: "Kids — até 15 anos",
  ADULTO: "Adulto — 16 anos ou mais",
};

/**
 * As duas escalas, na ordem de progressão.
 *
 * A ordem importa: é ela que a lista suspensa usa, e faixa fora de ordem numa
 * lista de graduação é lida como erro por quem conhece o esporte.
 */
export const GRADUACOES_POR_ESCALA: Record<Escala, readonly Graduacao[]> = {
  KIDS: [
    Graduacao.KIDS_BRANCA,
    Graduacao.KIDS_CINZA_BRANCA,
    Graduacao.KIDS_CINZA,
    Graduacao.KIDS_CINZA_PRETA,
    Graduacao.KIDS_AMARELA_BRANCA,
    Graduacao.KIDS_AMARELA,
    Graduacao.KIDS_AMARELA_PRETA,
    Graduacao.KIDS_LARANJA_BRANCA,
    Graduacao.KIDS_LARANJA,
    Graduacao.KIDS_LARANJA_PRETA,
    Graduacao.KIDS_VERDE_BRANCA,
    Graduacao.KIDS_VERDE,
    Graduacao.KIDS_VERDE_PRETA,
  ],
  ADULTO: [
    Graduacao.ADULTO_BRANCA,
    Graduacao.ADULTO_AZUL,
    Graduacao.ADULTO_ROXA,
    Graduacao.ADULTO_MARROM,
    Graduacao.ADULTO_PRETA,
  ],
};

export const ROTULO_GRADUACAO: Record<Graduacao, string> = {
  KIDS_BRANCA: "Branca",
  KIDS_CINZA_BRANCA: "Cinza-Branca",
  KIDS_CINZA: "Cinza",
  KIDS_CINZA_PRETA: "Cinza-Preta",
  KIDS_AMARELA_BRANCA: "Amarela-Branca",
  KIDS_AMARELA: "Amarela",
  KIDS_AMARELA_PRETA: "Amarela-Preta",
  KIDS_LARANJA_BRANCA: "Laranja-Branca",
  KIDS_LARANJA: "Laranja",
  KIDS_LARANJA_PRETA: "Laranja-Preta",
  KIDS_VERDE_BRANCA: "Verde-Branca",
  KIDS_VERDE: "Verde",
  KIDS_VERDE_PRETA: "Verde-Preta",
  ADULTO_BRANCA: "Branca",
  ADULTO_AZUL: "Azul",
  ADULTO_ROXA: "Roxa",
  ADULTO_MARROM: "Marrom",
  ADULTO_PRETA: "Preta",
};

/**
 * A escala que está gravada no próprio valor.
 *
 * É o que o prefixo do enum compra: sem ele, `BRANCA` seria ambíguo entre as
 * duas escalas e responder esta pergunta exigiria uma coluna de escala — que
 * envelheceria no aniversário de 16 anos e passaria a contradizer a faixa.
 */
export function escalaDaGraduacao(graduacao: Graduacao): Escala {
  return graduacao.startsWith("KIDS_") ? "KIDS" : "ADULTO";
}

/** A escala que a idade manda usar. */
export function escalaPorIdade(idade: number): Escala {
  return idade >= IDADE_ESCALA_ADULTA ? "ADULTO" : "KIDS";
}

/**
 * A escala de um aluno, derivada da data de nascimento — nunca da turma.
 *
 * Derivada, e não guardada: a data de nascimento não muda, então esta função
 * não tem como discordar de si mesma. Duas colunas teriam.
 */
export function escalaDoAluno(
  nascimento: string | Date,
  hojeIso?: string,
): Escala {
  return escalaPorIdade(idadeHoje(nascimento, hojeIso));
}

/** As faixas que a lista suspensa deve oferecer para esta data de nascimento. */
export function graduacoesDisponiveis(
  nascimento: string | Date,
  hojeIso?: string,
): readonly Graduacao[] {
  return GRADUACOES_POR_ESCALA[escalaDoAluno(nascimento, hojeIso)];
}

/**
 * A faixa escolhida existe na escala que a idade determina?
 *
 * Comparação de prefixo contra a escala calculada, sem tabela de-para — o que
 * responde tanto "esta faixa serve para este aluno" quanto "este aluno precisa
 * ser reposicionado", que são a mesma pergunta vista de dois lados.
 */
export function graduacaoCombinaComIdade(
  graduacao: Graduacao,
  nascimento: string | Date,
  hojeIso?: string,
): boolean {
  return escalaDaGraduacao(graduacao) === escalaDoAluno(nascimento, hojeIso);
}

export function ehGrauValido(grau: number): boolean {
  return Number.isInteger(grau) && grau >= GRAU_MINIMO && grau <= GRAU_MAXIMO;
}

/** "Verde-Preta, 2º grau" — como a faixa aparece na lista e na ficha. */
export function descreverGraduacao(graduacao: Graduacao, grau: number): string {
  const faixa = ROTULO_GRADUACAO[graduacao];
  return grau > 0 ? `${faixa}, ${grau}º grau` : faixa;
}
