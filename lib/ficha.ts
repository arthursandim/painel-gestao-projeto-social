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
import { Papel, TipoDocumento, type VarianteFicha as PrismaVarianteFicha } from "@prisma/client";

import { IDADE_MAIORIDADE } from "@/lib/avisosAluno";
import { idadeHoje } from "@/lib/data";
import { podeVerDadosSensiveis } from "@/lib/selecaoAluno";

/**
 * Versão do template da ficha, mostrada na tela antes de imprimir e gravada no
 * registro do documento quando a fase 5 arquivar o PDF assinado.
 *
 * NÃO é impressa no papel — decisão tomada na fase 4 (ver "Ficha impressa ›
 * Versionamento do template" no CLAUDE.md). Quem arquiva pelo app fica
 * rastreado por `Documento.versaoFicha`; a ficha digitalizada fora do app não.
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

// O enum do banco, para a marcação de ficha entregue gravar a mesma coisa que
// o gerador escolhe.
export type VarianteFicha = PrismaVarianteFicha;

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

// ---------------------------------------------------------------------------
// Ficha assinada entregue (decidida pelo desenvolvedor em 2026-10-22)
//
// Uma checkbox no cadastro, até o envio do arquivo existir (item Documentos do
// backlog). Por baixo, o banco guarda QUAL variante foi entregue: a checkbox
// fala sempre da variante de hoje, e aos 18 a ficha de menor entregue deixa de
// marcar a caixa sem que ninguém precise desmarcá-la.

export type FichaEntregue = {
  fichaEntregueVariante: VarianteFicha | null;
  fichaEntregueEm: Date | null;
  fichaEntreguePorId: string | null;
};

export const SEM_FICHA_ENTREGUE: FichaEntregue = {
  fichaEntregueVariante: null,
  fichaEntregueEm: null,
  fichaEntreguePorId: null,
};

/**
 * O que gravar a partir da checkbox.
 *
 * - Marcada e já era a variante de hoje: nada muda. Salvar o telefone não
 *   reescreve quem recebeu a ficha nem quando.
 * - Marcada agora: grava a variante de hoje, com autor e data.
 * - Desmarcada sobre a variante de hoje: limpa — foi marcada por engano.
 * - Desmarcada sobre a variante antiga (a de menor, num aluno que fez 18): a
 *   caixa já aparecia desmarcada, e a ficha de menor continua registrada. É
 *   ela que faz o aviso dizer "ficha a refazer" em vez de "não entregue".
 */
export function registroDaFichaEntregue(
  atual: FichaEntregue,
  marcada: boolean,
  variante: VarianteFicha,
  autorId: string,
  agora: Date,
): FichaEntregue {
  const ehDeHoje = atual.fichaEntregueVariante === variante;
  if (marcada) {
    return ehDeHoje
      ? atual
      : { fichaEntregueVariante: variante, fichaEntregueEm: agora, fichaEntreguePorId: autorId };
  }
  return ehDeHoje ? SEM_FICHA_ENTREGUE : atual;
}
