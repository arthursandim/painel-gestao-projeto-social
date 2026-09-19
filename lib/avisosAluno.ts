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
  acimaCapacidade?: boolean;
  autorizacaoAcimaPor?: { nome: string } | null;
  autorizacaoAcimaJustificativa?: string | null;
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

  if (
    idade < IDADE_MAIORIDADE &&
    aluno.responsavelTipo !== undefined &&
    !aluno.responsavelTipo
  ) {
    avisos.push({
      codigo: "RESPONSAVEL",
      texto:
        "Menor de idade sem responsável legal definido. A ficha impressa precisa da assinatura de um responsável.",
    });
  }

  // "Aluno que completou 18 anos com ficha de menor vigente" depende da tabela
  // Documento, que só ganha tela na fase 5. Até lá o aviso é o de maioridade
  // sem a parte que diz qual ficha está vigente.
  if (idade >= IDADE_MAIORIDADE) {
    avisos.push({
      codigo: "FICHA_MAIORIDADE",
      texto:
        "Completou 18 anos: a ficha a ser assinada passa a ser a de adulto. Confira qual está arquivada.",
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
