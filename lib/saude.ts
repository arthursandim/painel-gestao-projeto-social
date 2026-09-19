// Dados de saúde do aluno.
//
// São categoria especial de dado pessoal pela LGPD (art. 5º, II) e, ainda
// assim, os únicos campos sensíveis que o PROFESSOR enxerga. A decisão é
// deliberada e está registrada em lib/selecaoAluno.ts: numa emergência no
// tatame, quem está presente é o professor, e a informação só serve para quem
// pode agir sobre ela nos primeiros minutos.
import { TipoSanguineo } from "@prisma/client";

/** Os oito tipos ABO/Rh, na ordem em que a lista suspensa os oferece. */
export const TIPOS_SANGUINEOS: readonly TipoSanguineo[] = [
  TipoSanguineo.A_POSITIVO,
  TipoSanguineo.A_NEGATIVO,
  TipoSanguineo.B_POSITIVO,
  TipoSanguineo.B_NEGATIVO,
  TipoSanguineo.AB_POSITIVO,
  TipoSanguineo.AB_NEGATIVO,
  TipoSanguineo.O_POSITIVO,
  TipoSanguineo.O_NEGATIVO,
];

export const ROTULO_TIPO_SANGUINEO: Record<TipoSanguineo, string> = {
  A_POSITIVO: "A+",
  A_NEGATIVO: "A−",
  B_POSITIVO: "B+",
  B_NEGATIVO: "B−",
  AB_POSITIVO: "AB+",
  AB_NEGATIVO: "AB−",
  O_POSITIVO: "O+",
  O_NEGATIVO: "O−",
};

export type CamposSaude = {
  tipoSanguineo?: TipoSanguineo | null;
  alergias?: string | null;
  problemasSaude?: string | null;
  medicamentosContinuos?: string | null;
};

/**
 * Há alguma informação de saúde registrada?
 *
 * Serve para a ficha destacar o painel só quando ele tem conteúdo. Um painel de
 * emergência vazio e sempre presente ensina a pessoa a ignorá-lo, e aí ele
 * deixa de funcionar no dia em que estiver preenchido.
 */
export function temDadosDeSaude(aluno: CamposSaude): boolean {
  return Boolean(
    aluno.tipoSanguineo ||
      aluno.alergias ||
      aluno.problemasSaude ||
      aluno.medicamentosContinuos,
  );
}
