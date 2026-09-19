import "server-only";

import type { Papel } from "@prisma/client";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  podeAcessar,
  temAlgumPapel,
  type RotaModulo,
} from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type UsuarioSessao = {
  id: string;
  authUserId: string;
  nome: string;
  email: string;
  papeis: Papel[];
};

/**
 * O usuário logado, ou null.
 *
 * O vínculo com o Supabase Auth é o `authUserId`, e só ele. Não existe busca
 * por e-mail como plano B de propósito: com plano B, um usuário criado direto
 * no painel do Supabase com um e-mail que já existe na tabela herdaria os
 * papéis daquela linha sem ninguém perceber. O vínculo é escrito uma vez, no
 * momento em que o app cria o usuário, e é explícito.
 *
 * `cache` guarda o resultado por requisição: o layout, a página e as actions
 * chamam esta função sem cada chamada virar uma ida ao banco.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const supabase = await criarClienteServidor();

  // getUser valida o token no servidor do Supabase. getSession apenas lê o
  // cookie, que o navegador pode ter forjado — não serve para decidir acesso.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      authUserId: true,
      nome: true,
      email: true,
      papeis: true,
      ativo: true,
    },
  });

  // Usuário desativado continua existindo na tabela (nada é apagado) e
  // continua tendo sessão válida no Supabase até o cookie expirar. Quem
  // desliga o acesso é esta checagem.
  if (!usuario || !usuario.ativo || !usuario.authUserId) return null;

  return {
    id: usuario.id,
    authUserId: usuario.authUserId,
    nome: usuario.nome,
    email: usuario.email,
    papeis: usuario.papeis,
  };
});

/** Exige sessão. Sem ela, manda para o login guardando o destino. */
export async function exigirUsuario(destino?: string): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) {
    redirect(destino ? `/login?proximo=${encodeURIComponent(destino)}` : "/login");
  }
  return usuario;
}

/**
 * Guarda de módulo. Cada layout de rota chama com a própria rota, e a lista de
 * papéis sai do mapa único em lib/permissoes.ts.
 *
 * Roda no servidor, antes de qualquer HTML da rota existir — é o que faz o
 * professor não abrir /inventario nem digitando a URL.
 */
export async function exigirAcesso(rota: RotaModulo): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario(rota);
  if (!podeAcessar(usuario.papeis, rota)) {
    forbidden();
  }
  return usuario;
}

/** Guarda de ação, para Server Actions e Route Handlers. */
export async function exigirPapeis(
  permitidos: readonly Papel[],
): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (!temAlgumPapel(usuario.papeis, permitidos)) {
    forbidden();
  }
  return usuario;
}
