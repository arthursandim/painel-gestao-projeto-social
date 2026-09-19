import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envPublico, lerChaveSecreta } from "@/lib/env";

/**
 * Cliente com a chave secreta, que ignora Row Level Security.
 *
 * Existe por um motivo só: criar, desativar e alterar usuários do Supabase
 * Auth, porque não há auto-cadastro — quem cria usuário é o admin, pelo app.
 *
 * O `import "server-only"` acima faz o build quebrar se algum componente de
 * cliente importar este arquivo por engano. É a proteção que impede a chave
 * secreta de virar string no bundle do navegador.
 */
export function criarClienteAdmin() {
  return createClient(envPublico.NEXT_PUBLIC_SUPABASE_URL, lerChaveSecreta(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
