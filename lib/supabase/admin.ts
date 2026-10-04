import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envPublico, lerChaveSecreta } from "@/lib/env";

/**
 * Cliente com a chave secreta, que ignora Row Level Security.
 *
 * Existe por dois motivos: criar, desativar e alterar usuários do Supabase
 * Auth, porque não há auto-cadastro — quem cria usuário é o admin, pelo app; e
 * ler e gravar no bucket privado de fotos (lib/storageFotos.ts), sempre depois
 * de uma Server Action conferir o papel.
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
