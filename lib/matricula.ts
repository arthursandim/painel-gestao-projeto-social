// Sem `import "server-only"` aqui, ao contrário de lib/auth.ts: este módulo
// precisa ser importável por scripts/verifica-regras.ts, que roda em Node puro
// e não tem a condição `react-server` que faz aquele pacote ficar quieto. O que
// mantém o arquivo no servidor é o `@prisma/client` logo abaixo, que não
// atravessa o bundle do navegador.
import { Prisma } from "@prisma/client";

/**
 * Matrícula sequencial, no formato A0001.
 *
 * A fonte do número é uma sequence do Postgres, não `MAX(matricula) + 1`. A
 * diferença aparece só quando duas pessoas cadastram ao mesmo tempo: com
 * MAX+1 as duas leem 41, as duas tentam gravar A0042 e uma perde; com a
 * sequence, `nextval` é atômico e entrega 42 e 43 sem combinar nada. Ela fica
 * de fora da transação de propósito — é isso que a torna imune a rollback e,
 * portanto, à colisão.
 *
 * O preço é buraco na numeração quando um cadastro falha depois de pegar o
 * número. Matrícula é identificador, não contagem: buraco não significa nada, e
 * duas pessoas com a mesma matrícula significaria muito.
 */
export const SEQUENCIA_MATRICULA = "Aluno_matricula_seq";

export const LARGURA_MATRICULA = 4;

export function formatarMatricula(numero: number | bigint): string {
  return `A${String(numero).padStart(LARGURA_MATRICULA, "0")}`;
}

export async function proximaMatricula(
  db: Prisma.TransactionClient,
): Promise<string> {
  const [linha] = await db.$queryRaw<{ valor: bigint }[]>`
    SELECT nextval('"Aluno_matricula_seq"') AS valor
  `;
  return formatarMatricula(linha.valor);
}

/**
 * O campo único que o banco recusou, ou null se o erro é outro.
 *
 * Existe porque a checagem prévia em JavaScript não é garantia: entre o
 * `findFirst` que não achou CPF repetido e o `create`, outra requisição pode
 * ter gravado. Quem garante unicidade é o índice; o código só precisa traduzir
 * a recusa dele para uma frase que a pessoa entenda.
 */
export function campoDuplicado(erro: unknown): string | null {
  if (
    !(erro instanceof Prisma.PrismaClientKnownRequestError) ||
    erro.code !== "P2002"
  ) {
    return null;
  }
  const alvo = erro.meta?.target;
  if (Array.isArray(alvo)) return String(alvo[0]);
  if (typeof alvo === "string") return alvo;
  return "";
}
