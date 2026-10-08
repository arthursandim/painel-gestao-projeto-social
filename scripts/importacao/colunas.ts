/**
 * As colunas da planilha de importação de alunos.
 *
 * Uma definição só, usada por quem gera o modelo e, depois, por quem lê a
 * planilha preenchida. Se as duas pontas tivessem cada uma a sua lista, bastaria
 * mudar a ordem de uma coluna num lado para o CPF ir parar no campo do RG — e a
 * importação não teria como perceber.
 *
 * A ordem segue a ficha em papel, que é de onde os dados vão ser digitados. Os
 * campos que só existem no digital entram ao lado do assunto a que pertencem:
 * sexo depois do nascimento, responsável legal depois da filiação, turma e grau
 * junto da graduação.
 */
import { Graduacao, ResponsavelTipo, Sexo, TipoSanguineo } from "@prisma/client";

import { GRADUACOES_POR_ESCALA, ROTULO_GRADUACAO } from "../../lib/graduacao";
import { ROTULO_RESPONSAVEL_TIPO } from "../../lib/responsavel";
import { ROTULO_TIPO_SANGUINEO, TIPOS_SANGUINEOS } from "../../lib/saude";
import { UFS } from "../../lib/validacoes";

/**
 * - `texto`: gravado como texto na planilha. CPF, RG, CEP e telefone também, de
 *   propósito — como número, o Excel apaga o zero à esquerda do CPF e mostra o
 *   telefone em notação científica, sem avisar.
 * - `data`: célula de data, exibida como dd/mm/aaaa.
 * - `decimal`: número com vírgula (peso, altura).
 * - `lista`: lista suspensa; as opções vêm de `LISTAS`.
 */
export type TipoColuna = "texto" | "data" | "decimal" | "lista";

export type NomeLista =
  | "sexo"
  | "turma"
  | "modalidade"
  | "graduacao"
  | "grau"
  | "responsavel"
  | "tipoSanguineo"
  | "uf";

export type Coluna = {
  /** O nome do campo em lib/esquemaAluno.ts. */
  campo: string;
  cabecalho: string;
  tipo: TipoColuna;
  lista?: NomeLista;
  obrigatorio?: boolean;
  largura: number;
  nota?: string;
};

export const COLUNAS: readonly Coluna[] = [
  // ------------------------------------------------------- identificação
  { campo: "nome", cabecalho: "Nome completo", tipo: "texto", obrigatorio: true, largura: 36 },
  { campo: "nascimento", cabecalho: "Data de nascimento", tipo: "data", obrigatorio: true, largura: 14, nota: "dd/mm/aaaa" },
  { campo: "sexo", cabecalho: "Sexo", tipo: "lista", lista: "sexo", obrigatorio: true, largura: 12, nota: "Não está na ficha em papel." },
  { campo: "naturalidade", cabecalho: "Naturalidade", tipo: "texto", largura: 18 },

  // ------------------------------------------------------------ filiação
  { campo: "nomePai", cabecalho: "Nome do pai", tipo: "texto", largura: 30 },
  { campo: "nomeMae", cabecalho: "Nome da mãe", tipo: "texto", largura: 30 },
  {
    campo: "responsavelTipo",
    cabecalho: "Responsável legal",
    tipo: "lista",
    lista: "responsavel",
    largura: 14,
    nota:
      "Pai ou Mãe: usa o nome já preenchido na coluna do pai ou da mãe.\n" +
      "Outro: preencha as duas colunas seguintes (avó, tio, guardião…).\n" +
      "Em branco: sem responsável definido — o app vai sinalizar se for menor.",
  },
  { campo: "responsavelNome", cabecalho: "Outro responsável — nome", tipo: "texto", largura: 28, nota: "Só quando o responsável legal for Outro." },
  { campo: "responsavelParentesco", cabecalho: "Outro responsável — parentesco", tipo: "texto", largura: 16, nota: "Só quando o responsável legal for Outro." },

  // ------------------------------------------------------------ endereço
  { campo: "endereco", cabecalho: "Logradouro", tipo: "texto", largura: 30 },
  { campo: "numero", cabecalho: "Número", tipo: "texto", largura: 9 },
  { campo: "bairro", cabecalho: "Bairro", tipo: "texto", largura: 18 },
  { campo: "cidade", cabecalho: "Cidade", tipo: "texto", largura: 18 },
  { campo: "estado", cabecalho: "Estado", tipo: "lista", lista: "uf", largura: 8 },
  { campo: "cep", cabecalho: "CEP", tipo: "texto", largura: 11, nota: "00000-000" },

  // ------------------------------------------------------------- contato
  { campo: "telefoneResponsavel", cabecalho: "Telefone do responsável", tipo: "texto", largura: 17, nota: "Com DDD. É o telefone da ficha em papel." },
  { campo: "telefoneAluno", cabecalho: "Telefone do aluno", tipo: "texto", largura: 17, nota: "Com DDD. Não está na ficha em papel." },
  { campo: "email", cabecalho: "E-mail", tipo: "texto", largura: 26, nota: "Não está na ficha em papel." },

  // ---------------------------------------------------------- documentos
  { campo: "rg", cabecalho: "RG", tipo: "texto", largura: 14 },
  { campo: "rgOrgaoEmissor", cabecalho: "Órgão emissor", tipo: "texto", largura: 11 },
  { campo: "rgUf", cabecalho: "UF do RG", tipo: "lista", lista: "uf", largura: 8 },
  { campo: "rgDataEmissao", cabecalho: "Data de emissão do RG", tipo: "data", largura: 14, nota: "dd/mm/aaaa" },
  { campo: "cpf", cabecalho: "CPF", tipo: "texto", largura: 15, nota: "Com ou sem pontuação. O dígito verificador é conferido na importação." },
  { campo: "escola", cabecalho: "Escola", tipo: "texto", largura: 26 },
  { campo: "serie", cabecalho: "Série", tipo: "texto", largura: 10 },

  // --------------------------------------------------------- modalidade
  { campo: "turmaId", cabecalho: "Turma", tipo: "lista", lista: "turma", obrigatorio: true, largura: 16, nota: "Não está na ficha em papel." },
  { campo: "modalidade", cabecalho: "Modalidade", tipo: "lista", lista: "modalidade", obrigatorio: true, largura: 12 },
  {
    campo: "graduacao",
    cabecalho: "Graduação",
    tipo: "lista",
    lista: "graduacao",
    obrigatorio: true,
    largura: 15,
    nota:
      "Escolha só a cor. A escala (Kids ou Adulto) sai da data de nascimento: " +
      "até 15 anos é Kids, a partir de 16 é Adulto; no ano em que faz 16 valem as duas.\n" +
      "Cor que não existe na escala da idade é recusada na importação, com o motivo.",
  },
  { campo: "grau", cabecalho: "Grau", tipo: "lista", lista: "grau", obrigatorio: true, largura: 7, nota: "0 a 4." },
  { campo: "graduacaoData", cabecalho: "Data da graduação", tipo: "data", largura: 14, nota: "dd/mm/aaaa" },
  { campo: "peso", cabecalho: "Peso (kg)", tipo: "decimal", largura: 9 },
  { campo: "altura", cabecalho: "Altura (m)", tipo: "decimal", largura: 9, nota: "Em metros: 1,45" },

  // --------------------------------------------------------------- saúde
  { campo: "tipoSanguineo", cabecalho: "Tipo sanguíneo", tipo: "lista", lista: "tipoSanguineo", largura: 10 },
  { campo: "alergias", cabecalho: "Alergias", tipo: "texto", largura: 26 },
  { campo: "problemasSaude", cabecalho: "Problemas de saúde", tipo: "texto", largura: 26 },
  { campo: "medicamentosContinuos", cabecalho: "Medicamentos de uso contínuo", tipo: "texto", largura: 26 },
];

/**
 * As cores da lista de graduação, sem repetir a Branca, que existe nas duas
 * escalas. A pessoa escolhe a cor; a escala é derivada do nascimento na
 * importação, como no formulário — a escala nunca é escolha de quem cadastra.
 */
export const CORES_GRADUACAO: readonly string[] = [
  ...new Set(
    [...GRADUACOES_POR_ESCALA.KIDS, ...GRADUACOES_POR_ESCALA.ADULTO].map(
      (g: Graduacao) => ROTULO_GRADUACAO[g],
    ),
  ),
];

export const ROTULO_SEXO: Record<Sexo, string> = { M: "Masculino", F: "Feminino" };

export const ROTULO_MODALIDADE = { JIU_JITSU: "Jiu-Jitsu" } as const;

/** As opções de cada lista suspensa. A de turma vem do banco, na geração. */
export function listas(turmas: readonly string[]): Record<NomeLista, readonly string[]> {
  return {
    sexo: Object.values(ROTULO_SEXO),
    turma: turmas,
    modalidade: Object.values(ROTULO_MODALIDADE),
    graduacao: CORES_GRADUACAO,
    grau: ["0", "1", "2", "3", "4"],
    responsavel: Object.values(ResponsavelTipo).map((r) => ROTULO_RESPONSAVEL_TIPO[r]),
    tipoSanguineo: TIPOS_SANGUINEOS.map((t: TipoSanguineo) => ROTULO_TIPO_SANGUINEO[t]),
    uf: UFS,
  };
}
