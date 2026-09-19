// Middleware de rota. No Next 16 o arquivo chama-se `proxy.ts`: a convenção
// `middleware.ts` está deprecada e o build avisa. Ter os dois é erro de build.
//
// Divisão de trabalho, de propósito:
//
//   aqui       — renova a sessão do Supabase e barra quem não está logado;
//   layouts    — decidem qual papel abre qual módulo (lib/auth.ts).
//
// O papel do usuário mora na tabela Usuario, e o proxy roda no edge, onde não
// há Prisma. Copiar os papéis para o token do Auth resolveria o acesso ao
// banco e criaria duas fontes da verdade que envelhecem em ritmos diferentes:
// admin tira o papel de alguém e o token antigo continua valendo até expirar.
// Uma fonte só, consultada no servidor, a cada requisição.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { envPublico } from "@/lib/env";

/** Rotas que existem sem sessão. */
const PUBLICAS = ["/login", "/auth"];

function ehPublica(pathname: string): boolean {
  return PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

export default async function proxy(request: NextRequest) {
  // Este objeto acompanha a requisição inteira: o Supabase grava nele os
  // cookies de sessão renovados. Trocá-lo por um NextResponse novo no fim
  // perderia a renovação e deslogaria o usuário de tempos em tempos.
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    envPublico.NEXT_PUBLIC_SUPABASE_URL,
    envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (paraGravar) => {
          for (const { name, value } of paraGravar) {
            request.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of paraGravar) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !ehPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Guarda o destino para devolver a pessoa onde ela tentou entrar.
    url.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos e imagens — que não têm o que proteger e
    // pagariam uma chamada de rede por requisição.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
