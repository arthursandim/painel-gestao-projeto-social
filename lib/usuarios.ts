// Excluir usuário (decidido pelo desenvolvedor em 2026-10-04).
//
// A regra do projeto é desativar, não apagar: quem sai é desativado e o
// histórico continua atribuído a ele. A exclusão existe só para quem NUNCA
// registrou nada — conta criada por engano, ou usuário de teste depois da
// limpeza do banco. Assim nenhum registro perde o autor: todas as chaves que
// apontam para Usuario são ON DELETE SET NULL, e excluir quem já lançou algo
// apagaria o nome dele da trilha em silêncio.
//
// Puro, para scripts/verifica-permissoes.ts conferir.
import type { Prisma } from "@prisma/client";

/**
 * Todas as relações de autoria do Usuario, com o rótulo que a tela mostra.
 * verifica-permissoes confere contra o modelo do Prisma que nenhuma ficou de
 * fora: relação nova que não entrar aqui faz a verificação falhar.
 */
export const RELACOES_DE_AUTORIA = {
  usuariosCriados: "usuários criados",
  alunosCriados: "alunos cadastrados",
  alunosAtualizados: "alunos editados",
  alunosDesligados: "alunos desligados",
  alunosAutorizados: "matrículas acima da capacidade autorizadas",
  presencasRegistradas: "presenças lançadas",
  documentosEnviados: "documentos enviados",
  esperaCriada: "entradas na lista de espera",
  esperaConvertida: "conversões da lista de espera",
  esperaRemovida: "remoções da lista de espera",
  esperaAtualizada: "edições na lista de espera",
  itensCriados: "itens cadastrados",
  itensAtualizados: "itens editados",
  emprestimosConcedidos: "empréstimos feitos",
  devolucoesRecebidas: "devoluções recebidas",
  movimentosRegistrados: "movimentos de estoque",
  configuracoesAtualizadas: "parâmetros alterados",
  turmasAtualizadas: "capacidades de turma alteradas",
} as const satisfies Partial<Record<keyof Prisma.UsuarioCountOutputTypeSelect, string>>;

export type RelacaoDeAutoria = keyof typeof RELACOES_DE_AUTORIA;

/** O `_count` que a consulta pede: todas as relações de autoria. */
export const CONTAGEM_DE_AUTORIA = Object.fromEntries(
  Object.keys(RELACOES_DE_AUTORIA).map((r) => [r, true]),
) as Record<RelacaoDeAutoria, true>;

/** "12 presenças lançadas, 3 alunos cadastrados" — só o que é maior que zero. */
export function descreverAutoria(contagem: Record<RelacaoDeAutoria, number>): string[] {
  return (Object.keys(RELACOES_DE_AUTORIA) as RelacaoDeAutoria[])
    .filter((r) => contagem[r] > 0)
    .map((r) => `${contagem[r]} ${RELACOES_DE_AUTORIA[r]}`);
}

/**
 * Pode excluir? Null quando pode; senão, o motivo que a tela mostra.
 *
 * - a própria conta, nunca;
 * - o último admin ativo, nunca — o projeto ficaria sem ninguém que entre em
 *   /config;
 * - quem tem qualquer registro de autoria, nunca: esse se desativa.
 */
export function erroDeExclusao(alvo: {
  ehVoce: boolean;
  ehUltimoAdminAtivo: boolean;
  autoria: readonly string[];
}): string | null {
  if (alvo.ehVoce) return "Você não pode excluir a própria conta.";
  if (alvo.ehUltimoAdminAtivo) return "Este é o único administrador ativo. Promova outro antes.";
  if (alvo.autoria.length > 0) {
    return `Já registrou ${alvo.autoria.join(", ")}. Excluir apagaria o autor desses registros — desative o acesso em vez de excluir.`;
  }
  return null;
}
