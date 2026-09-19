// O responsável legal é referência, não cópia.
//
// O banco guarda só `responsavelTipo`. Em PAI e MAE o nome sai de nomePai ou
// nomeMae **na leitura**, aqui. Se fosse cópia, corrigir o nome da mãe no
// cadastro deixaria o responsável com o nome antigo e ninguém perceberia — o
// dado erraria calado, que é o modo de falhar que o CLAUDE.md manda evitar.
//
// `responsavelNome` e `responsavelParentesco` existem apenas em OUTRO, que é o
// caso da avó, do tio, do guardião: aí não há de onde derivar.
import { ResponsavelTipo } from "@prisma/client";

export const ROTULO_RESPONSAVEL_TIPO: Record<ResponsavelTipo, string> = {
  PAI: "Pai",
  MAE: "Mãe",
  OUTRO: "Outro",
};

export type CamposResponsavel = {
  responsavelTipo?: ResponsavelTipo | null;
  responsavelNome?: string | null;
  responsavelParentesco?: string | null;
  nomePai?: string | null;
  nomeMae?: string | null;
};

export type Responsavel = { nome: string; parentesco: string };

export function responsavelDoAluno(
  aluno: CamposResponsavel,
): Responsavel | null {
  switch (aluno.responsavelTipo) {
    case ResponsavelTipo.PAI:
      return aluno.nomePai ? { nome: aluno.nomePai, parentesco: "Pai" } : null;
    case ResponsavelTipo.MAE:
      return aluno.nomeMae ? { nome: aluno.nomeMae, parentesco: "Mãe" } : null;
    case ResponsavelTipo.OUTRO:
      return aluno.responsavelNome
        ? {
            nome: aluno.responsavelNome,
            parentesco: aluno.responsavelParentesco ?? "Responsável",
          }
        : null;
    default:
      return null;
  }
}
