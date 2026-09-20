// A ficha impressa: qual variante, qual versão do template, quem pode gerar.
//
// Este é o TERCEIRO corte de idade do projeto, e ele não serve para os outros
// dois nem eles para ele:
//
//   turma   → Kids até 11a11m29d. Aos 12 vira Jovens/Adultos.   (lib/turma.ts)
//   escala  → faixa kids até 15.  Aos 16 vira escala adulta.    (lib/graduacao.ts)
//   ficha   → ficha de menor até 17. Aos 18 vira ficha adulta.  (aqui)
//
// Um aluno de 16 anos usa faixa adulta e assina ficha de MENOR. Um de 12 treina
// em Jovens/Adultos, usa faixa kids e assina ficha de menor. As três situações
// são normais e nenhuma é inconsistência.
import { Papel, TipoDocumento } from "@prisma/client";

import { IDADE_MAIORIDADE } from "@/lib/avisosAluno";
import { idadeHoje } from "@/lib/data";
import { podeVerDadosSensiveis } from "@/lib/selecaoAluno";

/**
 * Versão do template da ficha, impressa no rodapé e gravada no registro do
 * documento quando a fase 5 arquivar o PDF assinado.
 *
 * Sem isto, no dia em que a ficha mudar vão conviver duas gerações de documento
 * assinado sem nada dizer qual é qual — e depois não há como descobrir, porque a
 * única evidência é o papel já digitalizado.
 *
 * Regra: mudou texto de termo ou campo impresso, incrementa. Ajuste visual não
 * conta. A decisão de acrescentar a marca da Equipe Sul Tucujú, se um dia for
 * tomada, incrementa — é campo impresso.
 */
export const VERSAO_FICHA = "v1";

export type VarianteFicha = "MENOR" | "ADULTO";

/**
 * A variante sai da data de nascimento e de mais nada. Não existe escolha
 * manual: quem imprime não decide se o aluno é menor de idade.
 */
export function varianteDaFicha(
  nascimento: string | Date,
  hojeIso?: string,
): VarianteFicha {
  return idadeHoje(nascimento, hojeIso) < IDADE_MAIORIDADE ? "MENOR" : "ADULTO";
}

/** O tipo de documento que a fase 5 vai usar ao arquivar a ficha assinada. */
export const TIPO_DOCUMENTO_DA_VARIANTE: Record<VarianteFicha, TipoDocumento> = {
  MENOR: TipoDocumento.FICHA_MENOR,
  ADULTO: TipoDocumento.FICHA_ADULTO,
};

export const ROTULO_VARIANTE: Record<VarianteFicha, string> = {
  MENOR: "Menor de idade",
  ADULTO: "Maior de idade",
};

/** Quem assina o papel, em cada variante. */
export const QUEM_ASSINA: Record<VarianteFicha, string> = {
  MENOR: "Assinatura do responsável",
  ADULTO: "Assinatura do aluno",
};

/**
 * Quem pode gerar a ficha.
 *
 * NÃO é quem abre /alunos. O professor abre /alunos — consulta a turma — e a
 * ficha imprime RG, CPF, endereço, telefone, escola e série, que são
 * exatamente as quatro linhas "Não" da tabela de visibilidade do CLAUDE.md.
 * Deixar a rota sob `exigirAcesso("/alunos")` entregaria num PDF o que o
 * seletor de campos recusa a entregar num JSON.
 *
 * Delega a `podeVerDadosSensiveis` em vez de repetir a lista de papéis: se um
 * dia a tabela de visibilidade mudar, a ficha muda junto, sem ninguém lembrar
 * de vir aqui.
 */
export function podeImprimirFicha(papeis: readonly Papel[]): boolean {
  return podeVerDadosSensiveis(papeis);
}
