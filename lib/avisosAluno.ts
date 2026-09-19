// Os avisos permanentes do cadastro.
//
// Informam, nunca agem, e não carregam botão de ação própria — é o princípio
// que governa o app inteiro: o sistema sinaliza, a pessoa decide. Cada aviso
// dura enquanto a situação durar, e some quando alguém a resolve no cadastro.
//
// Puro e isomórfico de propósito: a mesma função roda no servidor, para a lista
// e a ficha do aluno, e no navegador, para o formulário reagir enquanto a
// pessoa digita a data de nascimento. Duas implementações divergiriam.
import type { Graduacao, ResponsavelTipo } from "@prisma/client";

import { idadeHoje } from "@/lib/data";
import { escalaDaGraduacao, escalaPorIdade, ROTULO_ESCALA } from "@/lib/graduacao";
import { idadeCombinaComTurma, IDADE_JOVENS_ADULTOS, turmaEsperada } from "@/lib/turma";

export const IDADE_MAIORIDADE = 18;

export type CodigoAviso =
  | "TURMA"
  | "ESCALA"
  | "RESPONSAVEL"
  | "ESCOLA"
  | "FICHA_MAIORIDADE"
  | "CAPACIDADE";

export type Aviso = {
  codigo: CodigoAviso;
  texto: string;
};

/**
 * O que um aviso precisa saber.
 *
 * Campos opcionais porque a visão do professor não traz `responsavelTipo` nem
 * a autorização de capacidade: o aviso correspondente simplesmente não aparece
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
  acimaCapacidade?: boolean;
  autorizacaoAcimaPor?: { nome: string } | null;
  autorizacaoAcimaJustificativa?: string | null;
  /**
   * Preenchido a partir da tabela Documento, que só ganha tela na fase 5. Até
   * lá ninguém passa este campo e o aviso de maioridade não aparece — o que é
   * a resposta honesta: sem a lista de documentos, o app não sabe qual ficha
   * está arquivada, e um aviso em todo aluno adulto seria ruído permanente.
   */
  temFichaMenorVigente?: boolean;
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
  const escalaDaFaixa = escalaDaGraduacao(aluno.graduacao);
  const escalaDaIdade = escalaPorIdade(idade);
  if (escalaDaFaixa !== escalaDaIdade) {
    avisos.push({
      codigo: "ESCALA",
      texto: `Tem ${idade} anos, que é escala ${ROTULO_ESCALA[escalaDaIdade]}, e está com faixa da escala ${ROTULO_ESCALA[escalaDaFaixa]} — reposicione a graduação.`,
    });
  }

  // Daqui para baixo, o corte dos 18 — a régua da maioridade, que não tem nada
  // a ver com as duas de cima. Para o aluno adulto estes campos não são
  // cobrados: ele assina a própria ficha e responde por si.
  const menor = idade < IDADE_MAIORIDADE;

  if (menor && aluno.responsavelTipo !== undefined && !aluno.responsavelTipo) {
    avisos.push({
      codigo: "RESPONSAVEL",
      texto:
        "Menor de idade sem responsável legal definido. A ficha impressa precisa da assinatura de um responsável.",
    });
  }

  // `escola !== undefined` distingue "está em branco" de "não veio na consulta":
  // a visão reduzida do professor não traz escola nem série, e inventar a
  // pendência com base num campo que ninguém leu seria mentir.
  if (menor && aluno.escola !== undefined && (!aluno.escola || !aluno.serie)) {
    avisos.push({
      codigo: "ESCOLA",
      texto: !aluno.escola
        ? "Menor de idade sem escola informada."
        : "Menor de idade sem a série informada.",
    });
  }

  if (!menor && aluno.temFichaMenorVigente) {
    avisos.push({
      codigo: "FICHA_MAIORIDADE",
      texto:
        "Completou 18 anos e a ficha de menor ainda é a vigente. A ficha a assinar passa a ser a de adulto.",
    });
  }

  if (aluno.acimaCapacidade) {
    const quem = aluno.autorizacaoAcimaPor?.nome ?? "um administrador";
    const porque = aluno.autorizacaoAcimaJustificativa
      ? ` Justificativa: ${aluno.autorizacaoAcimaJustificativa}`
      : "";
    avisos.push({
      codigo: "CAPACIDADE",
      texto: `Matrícula acima da capacidade da turma, autorizada por ${quem}.${porque}`,
    });
  }

  return avisos;
}

/** A turma que a idade indica — usada só para redigir o aviso, nunca para agir. */
export { turmaEsperada };
