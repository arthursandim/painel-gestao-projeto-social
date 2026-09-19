"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { rotaInternaSegura } from "@/lib/rotaSegura";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  senha: z.string().min(1, { error: "Informe a senha." }),
  proximo: z.string().optional(),
});

export type EstadoLogin = { erro?: string };

export async function entrar(
  _estado: EstadoLogin,
  dados: FormData,
): Promise<EstadoLogin> {
  const analise = esquema.safeParse({
    email: dados.get("email"),
    senha: dados.get("senha"),
    proximo: dados.get("proximo") ?? undefined,
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  });

  if (error) {
    // Mensagem única para credencial errada e usuário inexistente: distinguir
    // as duas diria a quem tentasse adivinhar quais e-mails existem no projeto.
    return { erro: "E-mail ou senha incorretos." };
  }

  redirect(rotaInternaSegura(analise.data.proximo));
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
