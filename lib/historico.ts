// Histórico de parâmetros e exceções de turma (decidido em 2026-10-04).
//
// Cada alteração de capacidade, do N de faltas e cada matrícula acima da
// capacidade vira uma linha de EventoHistorico, gravada na mesma transação que
// a mudança. A tela é /config/historico, só do admin. A exceção de capacidade é
// fato da turma: não aparece mais nos avisos do cadastro do aluno.
import { TipoEventoHistorico, type Prisma } from "@prisma/client";

export const ROTULO_TIPO_EVENTO: Record<TipoEventoHistorico, string> = {
  CAPACIDADE_ALTERADA: "Capacidade alterada",
  FALTAS_ALTERADO: "Faltas para alerta alterado",
  MATRICULA_ACIMA_CAPACIDADE: "Matrícula acima da capacidade",
};

export const TIPOS_EVENTO: readonly TipoEventoHistorico[] = [
  TipoEventoHistorico.CAPACIDADE_ALTERADA,
  TipoEventoHistorico.FALTAS_ALTERADO,
  TipoEventoHistorico.MATRICULA_ACIMA_CAPACIDADE,
];

/** "41/40": a ocupação que a turma passa a ter com a matrícula autorizada. */
export function ocupacaoResultante(ativosAntes: number, capacidade: number): string {
  return `${ativosAntes + 1}/${capacidade}`;
}

/** O que a linha do histórico diz, sem o autor e a data (que são colunas). */
export function descreverEvento(evento: {
  tipo: TipoEventoHistorico;
  valorAnterior: string | null;
  valorNovo: string | null;
}): string {
  const de = evento.valorAnterior ?? "—";
  const para = evento.valorNovo ?? "—";
  switch (evento.tipo) {
    case TipoEventoHistorico.CAPACIDADE_ALTERADA:
      return `Capacidade de ${de} para ${para} vagas`;
    case TipoEventoHistorico.FALTAS_ALTERADO:
      return `Alerta de evasão de ${de} para ${para} faltas consecutivas`;
    case TipoEventoHistorico.MATRICULA_ACIMA_CAPACIDADE:
      return evento.valorNovo ? `Turma passou a ${para}` : "Ocupação no momento não registrada";
  }
}

/** Linha de matrícula acima da capacidade, para gravar junto com o aluno. */
export function eventoMatriculaAcima(dados: {
  turmaId: string;
  alunoId: string;
  ativosAntes: number;
  capacidade: number;
  justificativa: string;
  autorId: string;
}): Prisma.EventoHistoricoUncheckedCreateInput {
  return {
    tipo: TipoEventoHistorico.MATRICULA_ACIMA_CAPACIDADE,
    turmaId: dados.turmaId,
    alunoId: dados.alunoId,
    valorNovo: ocupacaoResultante(dados.ativosAntes, dados.capacidade),
    justificativa: dados.justificativa,
    autorId: dados.autorId,
  };
}
