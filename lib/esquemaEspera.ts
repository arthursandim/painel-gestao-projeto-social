// O contrato da lista de espera.
//
// Dados mínimos de propósito — a pessoa ainda não é aluno. Nome, nascimento e
// turma pretendida são obrigatórios; telefone e observação, não.
//
// A turma pretendida é opcional no banco e obrigatória aqui (decisão do
// desenvolvedor na fase 7): a fila é por turma, porque a vaga libera por turma.
import { z } from "zod";

import { diaEhFuturo } from "@/lib/data";
import { campoNascimento, campoTelefone, dia, opcional } from "@/lib/esquemaAluno";

export const esquemaEspera = z.object({
  nome: z
    .string()
    .trim()
    .min(3, { error: "Informe o nome completo." })
    .max(150),
  nascimento: campoNascimento,
  telefone: campoTelefone("Telefone"),
  turmaPretendidaId: z.uuid({ error: "Escolha a turma pretendida." }),
  // Editável porque a fila em papel já existe: quem entrou em agosto não pode
  // ir para o fim só porque foi digitado hoje. Futuro não existe.
  dataEntrada: dia("Data de entrada").refine((v) => !diaEhFuturo(v), {
    error: "A data de entrada não pode estar no futuro.",
  }),
  observacao: opcional(z.string().trim().min(1).max(500)),
});

export type DadosEspera = z.infer<typeof esquemaEspera>;

export const CAMPOS_ESPERA = [
  "nome",
  "nascimento",
  "telefone",
  "turmaPretendidaId",
  "dataEntrada",
  "observacao",
] as const;

export function camposEsperaDoForm(form: FormData): Record<string, unknown> {
  return Object.fromEntries(CAMPOS_ESPERA.map((c) => [c, form.get(c)]));
}

/**
 * Saída da fila sem conversão. O motivo é obrigatório (decisão da fase 7):
 * sem ele, daqui a seis meses ninguém sabe se a pessoa desistiu, mudou de
 * cidade ou foi tirada por engano.
 */
export const esquemaRemocaoEspera = z.object({
  id: z.uuid({ error: "Registro inválido." }),
  motivo: z
    .string({ error: "Informe o motivo da remoção." })
    .trim()
    .min(3, { error: "Informe o motivo da remoção." })
    .max(300),
});

/**
 * Ordem da fila: por turma pretendida, depois por data de entrada; empate no
 * mesmo dia, quem foi digitado antes. Pura, para o verifica-regras conferir.
 */
export function ordemDaFila<
  T extends { turmaNome: string; dataEntrada: string; criadoEm: Date },
>(a: T, b: T): number {
  if (a.turmaNome !== b.turmaNome) return a.turmaNome < b.turmaNome ? -1 : 1;
  if (a.dataEntrada !== b.dataEntrada) return a.dataEntrada < b.dataEntrada ? -1 : 1;
  return a.criadoEm.getTime() - b.criadoEm.getTime();
}

