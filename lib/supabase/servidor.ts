import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { envPublico } from "@/lib/env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Usa a chave publishable, não a secreta: as escritas que exigem privilégio
 * (criar usuário de auth) passam por lib/supabase/admin.ts.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    envPublico.NEXT_PUBLIC_SUPABASE_URL,
    envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (paraGravar) => {
          try {
            for (const { name, value, options } of paraGravar) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie. Não é erro: o proxy
            // já renovou a sessão antes desta requisição chegar aqui.
          }
        },
      },
    },
  );
}
