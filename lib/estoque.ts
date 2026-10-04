// Regras do inventário que não precisam de banco.
//
// Item não tem coluna de quantidade, de propósito: o total é a soma dos
// movimentos, e o disponível é o total menos o que está emprestado. Sem coluna
// não existe caminho para alguém escrever um saldo — nem tela, nem script de
// correção. Este arquivo é onde a conta é feita, e é puro para que
// scripts/verifica-regras.ts a confira sem Postgres.
import { EstadoConservacao, TipoMovimento } from "@prisma/client";
import { z } from "zod";

import { diaEhFuturo } from "@/lib/data";
import { dia, opcional } from "@/lib/esquemaAluno";

export const ROTULO_ESTADO: Record<EstadoConservacao, string> = {
  NOVO: "Novo",
  BOM: "Bom",
  REGULAR: "Regular",
  RUIM: "Ruim",
  INSERVIVEL: "Inservível",
};

export const ESTADOS: readonly EstadoConservacao[] = [
  EstadoConservacao.NOVO,
  EstadoConservacao.BOM,
  EstadoConservacao.REGULAR,
  EstadoConservacao.RUIM,
  EstadoConservacao.INSERVIVEL,
];

/** Teto só contra erro de digitação (3000 em vez de 30). */
export const QUANTIDADE_MAXIMA = 10_000;

// ---------------------------------------------------------------------------
// Saldo

export type Contagem = {
  /** O que o projeto tem: Σ ENTRADA − Σ SAIDA. Emprestado continua contando. */
  total: number;
  /** Empréstimos com status EMPRESTADO. */
  emprestados: number;
  /** total − emprestados. Ninguém edita este número direto. */
  disponivel: number;
};

export function contagem(entradas: number, saidas: number, emprestados: number): Contagem {
  const total = entradas - saidas;
  return { total, emprestados, disponivel: total - emprestados };
}

export const CONTAGEM_ZERADA: Contagem = { total: 0, emprestados: 0, disponivel: 0 };

/**
 * Monta a contagem de vários itens a partir de dois `groupBy` — um de
 * MovimentoEstoque por (itemId, tipo) e um de Emprestimo EMPRESTADO por itemId
 * — em vez de uma consulta por item na lista.
 */
export function contagensPorItem(
  movimentos: readonly { itemId: string; tipo: TipoMovimento; quantidade: number }[],
  emprestimos: readonly { itemId: string; quantidade: number }[],
): Map<string, Contagem> {
  const entradas = new Map<string, number>();
  const saidas = new Map<string, number>();
  for (const m of movimentos) {
    const alvo = m.tipo === TipoMovimento.ENTRADA ? entradas : saidas;
    alvo.set(m.itemId, (alvo.get(m.itemId) ?? 0) + m.quantidade);
  }
  const emprestados = new Map(emprestimos.map((e) => [e.itemId, e.quantidade]));

  const ids = new Set([...entradas.keys(), ...saidas.keys(), ...emprestados.keys()]);
  return new Map(
    [...ids].map((id) => [
      id,
      contagem(entradas.get(id) ?? 0, saidas.get(id) ?? 0, emprestados.get(id) ?? 0),
    ]),
  );
}

/**
 * Abaixo do mínimo compara o **total**, não o disponível: kimono emprestado
 * continua sendo do projeto, e um item todo na rua não precisa ser comprado.
 * Mínimo 0 é "sem mínimo".
 */
export function abaixoDoMinimo(total: number, minimo: number): boolean {
  return minimo > 0 && total < minimo;
}

// ---------------------------------------------------------------------------
// Empréstimo em aberto trava desativação e "pode ser emprestado"

export type Decisao = { erro: string } | { aviso: string } | null;

/**
 * Desativar o item, ou desmarcar "pode ser emprestado", com empréstimo em
 * aberto (decisão do desenvolvedor na fase 8): INVENTARIO é barrado — devolva
 * ou marque perdido antes; ADMIN pode, e o app avisa. O empréstimo aberto
 * continua aberto: nada é devolvido sozinho.
 */
export function decidirComEmprestimoAberto(
  acao: "desativar" | "desmarcarEmprestavel",
  emprestados: number,
  admin: boolean,
): Decisao {
  if (emprestados <= 0) return null;
  const quantos =
    emprestados === 1 ? "1 unidade emprestada" : `${emprestados} unidades emprestadas`;
  const oQue =
    acao === "desativar"
      ? "desativar o item"
      : "desmarcar \"pode ser emprestado\"";
  if (!admin) {
    return {
      erro: `Este item tem ${quantos}. Para ${oQue}, registre antes a devolução ou a perda. Só a administração pode fazer isso com empréstimo em aberto.`,
    };
  }
  return {
    aviso: `Este item tem ${quantos}. Os empréstimos continuam abertos e precisam ser devolvidos ou marcados como perdidos.`,
  };
}

// ---------------------------------------------------------------------------
// Formulário

const texto = (max: number) => opcional(z.string().trim().min(1).max(max));

/** Inteiro vindo do formulário. O vazio é barrado antes do coerce (vazio → 0). */
function inteiro(rotulo: string, min: number, max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number({ error: `${rotulo}: informe um número.` })
      .int({ error: `${rotulo}: informe um número inteiro.` })
      .min(min, { error: `${rotulo}: o mínimo é ${min}.` })
      .max(max, { error: `${rotulo}: o máximo é ${max}.` }),
  );
}

/** Quantidade de movimento: sempre positiva. O sentido é o tipo, nunca o sinal. */
export const campoQuantidade = inteiro("Quantidade", 1, QUANTIDADE_MAXIMA);

/** Checkbox nativo: marcado chega como "on"; desmarcado, não chega. */
const marcado = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export const esquemaItem = z.object({
  descricao: z
    .string({ error: "Informe a descrição." })
    .trim()
    .min(2, { error: "Informe a descrição." })
    .max(150),
  categoria: texto(60),
  observacao: texto(500),
  unidadeMedida: z
    .string({ error: "Informe a unidade de medida." })
    .trim()
    .min(1, { error: "Informe a unidade de medida." })
    .max(20),
  quantidadeMinima: inteiro("Quantidade mínima", 0, QUANTIDADE_MAXIMA),
  identificacao: texto(60),
  estadoConservacao: z.enum(EstadoConservacao, { error: "Escolha o estado de conservação." }),
  podeSerEmprestado: marcado,
});

/**
 * No cadastro, a quantidade é obrigatória e ≥ 1 (decisão da fase 8): ela vira o
 * primeiro movimento de ENTRADA, e o check constraint não aceita movimento de 0.
 * Item que ainda não chegou não é cadastrado.
 */
export const esquemaItemNovo = esquemaItem.extend({ quantidade: campoQuantidade });

export type DadosItem = z.output<typeof esquemaItem>;

export const CAMPOS_ITEM = [
  "descricao",
  "categoria",
  "observacao",
  "unidadeMedida",
  "quantidadeMinima",
  "identificacao",
  "estadoConservacao",
  "podeSerEmprestado",
] as const;

export function camposItemDoForm(form: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...CAMPOS_ITEM, "quantidade"].map((c) => [c, form.get(c)]),
  );
}

/** Motivo do primeiro movimento, o que nasce com o cadastro. */
export const MOTIVO_CADASTRO = "Cadastro do item";

// ---------------------------------------------------------------------------
// Movimentos

export const ROTULO_TIPO_MOVIMENTO: Record<TipoMovimento, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

/**
 * Data de movimento, empréstimo ou devolução (decisão da fase 8, como na
 * chamada): futuro bloqueado aqui, no servidor; retroativa passa e a tela avisa.
 */
export const diaNaoFuturo = (rotulo: string) =>
  dia(rotulo).refine((v) => !diaEhFuturo(v), {
    error: `${rotulo}: não pode estar no futuro.`,
  });

export const campoMotivo = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(3, { error: "Informe o motivo." })
  .max(300);

export const esquemaMovimento = z.object({
  itemId: z.uuid({ error: "Item inválido." }),
  tipo: z.enum(TipoMovimento, { error: "Escolha entrada ou saída." }),
  quantidade: campoQuantidade,
  data: diaNaoFuturo("Data"),
  motivo: campoMotivo,
});

/**
 * Saída definitiva (perda, descarte, doação) só do que está **disponível**, não
 * do total: unidade emprestada está com um aluno e sai pelo empréstimo —
 * devolvida, ou marcada como perdida, que gera a própria SAIDA. Se a saída
 * pudesse levar a unidade emprestada, o disponível ficaria negativo.
 *
 * O banco não barra (o check constraint garante quantidade positiva, não saldo
 * suficiente): esta é a regra de aplicação da fase 8.
 */
export function erroDeSaida(quantidade: number, c: Contagem): string | null {
  if (quantidade <= c.disponivel) return null;
  const emprestados =
    c.emprestados === 1
      ? " A unidade emprestada sai pela devolução ou pela marcação de perdido."
      : c.emprestados > 1
        ? ` As ${c.emprestados} emprestadas saem pela devolução ou pela marcação de perdido.`
        : "";
  return `Saída de ${quantidade} maior que o disponível (${c.disponivel}).${emprestados}`;
}
