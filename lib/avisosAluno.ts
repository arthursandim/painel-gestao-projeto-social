// Os avisos permanentes do cadastro.
//
// Informam, nunca agem, e não carregam botão de ação própria — é o princípio
// que governa o app inteiro: o sistema sinaliza, a pessoa decide. Cada aviso
// dura enquanto a situação durar, e some quando alguém a resolve no cadastro.
//
// Puro e isomórfico de propósito: a mesma função roda no servidor, para a lista
// e a ficha do aluno, e no navegador, para o formulário reagir enquanto a
// pessoa digita a data de nascimento. Duas implementações divergiriam.
import type { Graduacao, ResponsavelTipo, VarianteFicha } from "@prisma/client";

import { idadeHoje } from "@/lib/data";
import {
  escalaDaGraduacao,
  escalaPorIdade,
  escalasPermitidas,
  ROTULO_ESCALA,
} from "@/lib/graduacao";
import { idadeCombinaComTurma, IDADE_JOVENS_ADULTOS, turmaEsperada } from "@/lib/turma";

export const IDADE_MAIORIDADE = 18;

export type CodigoAviso =
  | "TURMA"
  | "ESCALA"
  | "CADASTRO"
  | "FICHA"
  | "FICHA_MAIORIDADE";

export type Aviso = {
  codigo: CodigoAviso;
  texto: string;
};

/**
 * O que um aviso precisa saber.
 *
 * Campos opcionais porque a visão do professor não traz `responsavelTipo`: o
 * aviso correspondente simplesmente não aparece
 * para ele, em vez de a função quebrar ou de alguém montar um `select` à mão
 * para alimentá-la.
 */
export type AlunoParaAviso = {
  nascimento: string | Date;
  graduacao: Graduacao;
  turma: { codigo: string; nome: string };
  responsavelTipo?: ResponsavelTipo | null;
  escola?: string | null;
  serie?: string | null;
  rg?: string | null;
  cpf?: string | null;
  telefoneResponsavel?: string | null;
  telefoneAluno?: string | null;
  /**
   * Qual ficha assinada foi entregue — a marcação do cadastro (lib/ficha.ts).
   * `undefined` é "não veio na consulta", como em `escola`: a visão do
   * professor não traz a coluna, e ele não recebe aviso de ficha.
   */
  fichaEntregueVariante?: VarianteFicha | null;
};

export function avisosDoAluno(
  aluno: AlunoParaAviso,
  hojeIso?: string,
): Aviso[] {
  const avisos: Aviso[] = [];
  const idade = idadeHoje(aluno.nascimento, hojeIso);

  // Corte dos 12 anos — o da turma.
  if (!idadeCombinaComTurma(idade, aluno.turma.codigo)) {
    avisos.push({
      codigo: "TURMA",
      texto:
        idade >= IDADE_JOVENS_ADULTOS
          ? `Tem ${idade} anos e continua na turma ${aluno.turma.nome}. A partir dos ${IDADE_JOVENS_ADULTOS} a turma é Jovens/Adultos — altere o campo Turma.`
          : `Tem ${idade} anos e está na turma ${aluno.turma.nome}. Até os ${IDADE_JOVENS_ADULTOS - 1} a turma é Kids — confira o campo Turma.`,
    });
  }

  // Corte dos 16 anos — o da escala de graduação. É outra régua, e um aluno de
  // 12 a 15 anos em Jovens/Adultos com faixa kids não aparece aqui: está certo.
  // No ano em que faz 16 as duas escalas valem, então o aviso de faixa kids só
  // chega no aniversário.
  const escalaDaFaixa = escalaDaGraduacao(aluno.graduacao);
  const escalaDaIdade = escalaPorIdade(idade);
  if (!escalasPermitidas(aluno.nascimento, hojeIso).includes(escalaDaFaixa)) {
    avisos.push({
      codigo: "ESCALA",
      texto: `Tem ${idade} anos, que é escala ${ROTULO_ESCALA[escalaDaIdade]}, e está com faixa da escala ${ROTULO_ESCALA[escalaDaFaixa]} — reposicione a graduação.`,
    });
  }

  // Daqui para baixo, o corte dos 18 — a régua da maioridade, que não tem nada
  // a ver com as duas de cima. Ela decide o que o cadastro cobra e qual ficha
  // vale.
  const menor = idade < IDADE_MAIORIDADE;

  const pendencias = pendenciasDoCadastro(aluno, hojeIso);
  if (pendencias.length > 0) {
    avisos.push({
      codigo: "CADASTRO",
      texto: `Cadastro incompleto — falta ${juntarComE(pendencias)}. O cadastro vale assim mesmo; o aviso fica até o campo ser preenchido.`,
    });
  }

  // A ficha assinada é o único documento cobrado por enquanto (decisão de
  // 2026-10-22). A variante sai do mesmo corte dos 18 que escolhe a ficha
  // impressa; a de menor entregue não vale para o aluno que já é adulto.
  const variante: VarianteFicha = menor ? "MENOR" : "ADULTO";
  const entregue = aluno.fichaEntregueVariante;
  if (entregue !== undefined && entregue !== variante) {
    avisos.push(
      !menor && entregue === "MENOR"
        ? {
            codigo: "FICHA_MAIORIDADE",
            texto:
              "Completou 18 anos e a ficha entregue é a de menor. A ficha a assinar passa a ser a de adulto.",
          }
        : {
            codigo: "FICHA",
            texto: `Ficha assinada não entregue (${menor ? "ficha de menor, assinada pelo responsável" : "ficha de adulto, assinada pelo aluno"}). Imprima, colete a assinatura e marque a entrega no cadastro.`,
          },
    );
  }

  // Matrícula acima da capacidade NÃO é aviso do cadastro (decisão de
  // 2026-10-04): é fato da turma, e a autorização fica no histórico
  // (/config/historico), não na tela do aluno.

  return avisos;
}

/**
 * O que o cadastro cobra (decisão de 2026-10-22). Nenhum é obrigatório para
 * cadastrar — formulário rígido produz cadastro não feito ou dado inventado —,
 * mas todos acusam pendência enquanto estiverem em branco:
 *
 * - RG e CPF, de todos;
 * - menor: escola, série, responsável legal e telefone do responsável;
 * - adulto: telefone de contato (a coluna telefoneResponsavel, que é o que a
 *   ficha imprime). O campo "telefone do aluno" não aparece para o adulto.
 *
 * Campo `undefined` é "não veio na consulta": a visão do professor não traz
 * nenhum destes, e pendência de campo que ninguém leu seria inventada.
 */
export function pendenciasDoCadastro(aluno: AlunoParaAviso, hojeIso?: string): string[] {
  const menor = idadeHoje(aluno.nascimento, hojeIso) < IDADE_MAIORIDADE;
  const cobrados: [string, string | null | undefined][] = [
    ["RG", aluno.rg],
    ["CPF", aluno.cpf],
    ...(menor
      ? ([
          ["telefone do responsável", aluno.telefoneResponsavel],
          ["responsável legal", aluno.responsavelTipo],
          ["escola", aluno.escola],
          ["série", aluno.serie],
        ] as [string, string | null | undefined][])
      : ([["telefone de contato", aluno.telefoneResponsavel]] as [string, string | null | undefined][])),
  ];
  return cobrados
    .filter(([, valor]) => valor !== undefined && !valor?.trim())
    .map(([rotulo]) => rotulo);
}

/** "RG, CPF e escola". */
function juntarComE(itens: readonly string[]): string {
  return itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** A turma que a idade indica — usada só para redigir o aviso, nunca para agir. */
export { turmaEsperada };
