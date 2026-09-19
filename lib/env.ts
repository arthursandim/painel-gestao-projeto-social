// Validação das variáveis de ambiente, para o app falhar no boot com uma
// mensagem clara em vez de falhar no meio de um login com "undefined".
//
// As referências a process.env são escritas por extenso de propósito: o Next
// só inlina NEXT_PUBLIC_* quando enxerga o nome literal no código. Acesso
// dinâmico (process.env[chave]) devolveria undefined no navegador.
import { z } from "zod";

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL precisa ser a URL do projeto Supabase.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local."),
});

function ler<T extends z.ZodType>(esquema: T, valores: unknown): z.infer<T> {
  const resultado = esquema.safeParse(valores);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Ambiente inválido:\n${problemas}`);
  }
  return resultado.data;
}

export const envPublico = ler(esquemaPublico, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

// A chave secreta ignora Row Level Security e nunca pode chegar ao navegador.
// Por isso ela não mora no objeto acima, e quem a lê é só lib/supabase/admin.ts,
// que é marcado como server-only.
export function lerChaveSecreta(): string {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) {
    throw new Error("Defina SUPABASE_SECRET_KEY no .env.local.");
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY existe no ambiente. O prefixo " +
        "NEXT_PUBLIC_ publica a chave no bundle do navegador — remova a " +
        "variável e use SUPABASE_SECRET_KEY.",
    );
  }
  return chave;
}
