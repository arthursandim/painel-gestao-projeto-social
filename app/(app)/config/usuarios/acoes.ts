"use server";

import { Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPapeis } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { CONTAGEM_DE_AUTORIA, descreverAutoria, erroDeExclusao } from "@/lib/usuarios";

export type EstadoForm = { erro?: string; ok?: string };

const SOMENTE_ADMIN = [Papel.ADMIN] as const;

const papelValido = z.enum(Papel);

const esquemaNovo = z.object({
  nome: z.string().trim().min(3, { error: "Informe o nome completo." }),
  email: z
    .email({ error: "Informe um e-mail válido." })
    .transform((v) => v.trim().toLowerCase()),
  senha: z
    .string()
    .min(8, { error: "A senha inicial precisa de ao menos 8 caracteres." }),
  papeis: z
    .array(papelValido)
    .min(1, { error: "Escolha ao menos um papel." }),
});

function papeisDoForm(dados: FormData): string[] {
  return dados.getAll("papeis").map(String);
}

/**
 * Cria usuário. Só admin, e não existe auto-cadastro em lugar nenhum do app.
 *
 * São duas escritas em sistemas diferentes — Supabase Auth e Postgres — e não
 * há transação que cubra as duas. A ordem é deliberada: cria no Auth, grava no
 * banco, e se o banco falhar, apaga o usuário de Auth recém-criado. O estado
 * intermediário que sobraria sem isso (login que existe, sem linha em Usuario)
 * é justamente o que `usuarioAtual` recusa, então seria uma conta fantasma que
 * ninguém consegue usar nem enxergar na lista.
 */
export async function criarUsuario(
  _estado: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  const autor = await exigirPapeis(SOMENTE_ADMIN);

  const analise = esquemaNovo.safeParse({
    nome: dados.get("nome"),
    email: dados.get("email"),
    senha: dados.get("senha"),
    papeis: papeisDoForm(dados),
  });
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { nome, email, senha, papeis } = analise.data;

  if (await prisma.usuario.findUnique({ where: { email } })) {
    return { erro: `Já existe um usuário com o e-mail ${email}.` };
  }

  const supabase = criarClienteAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    // Sem confirmação por e-mail: o projeto não manda notificação, e quem
    // entrega a senha inicial é o admin, pessoalmente.
    email_confirm: true,
  });

  if (error || !data.user) {
    return { erro: `Não foi possível criar o acesso: ${error?.message}` };
  }

  try {
    await prisma.usuario.create({
      data: {
        authUserId: data.user.id,
        nome,
        email,
        papeis,
        criadoPorId: autor.id,
      },
    });
  } catch (erro) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return {
      erro: `Acesso desfeito porque o cadastro falhou: ${
        erro instanceof Error ? erro.message : "erro desconhecido"
      }`,
    };
  }

  revalidatePath("/config/usuarios");
  return { ok: `${nome} criado. Entregue a senha inicial pessoalmente.` };
}

const esquemaPapeis = z.object({
  usuarioId: z.uuid(),
  papeis: z.array(papelValido).min(1, { error: "Escolha ao menos um papel." }),
});

export async function atualizarPapeis(
  _estado: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  const autor = await exigirPapeis(SOMENTE_ADMIN);

  const analise = esquemaPapeis.safeParse({
    usuarioId: dados.get("usuarioId"),
    papeis: papeisDoForm(dados),
  });
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { usuarioId, papeis } = analise.data;

  if (usuarioId === autor.id && !papeis.includes(Papel.ADMIN)) {
    return {
      erro: "Você não pode tirar o próprio papel de administração.",
    };
  }

  if (!papeis.includes(Papel.ADMIN)) {
    const impedimento = await impedeSeForUltimoAdmin(usuarioId);
    if (impedimento) return { erro: impedimento };
  }

  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis } });

  revalidatePath("/config/usuarios");
  return { ok: "Papéis atualizados." };
}

export async function alternarAtivo(
  _estado: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  const autor = await exigirPapeis(SOMENTE_ADMIN);

  const usuarioId = z.uuid().safeParse(dados.get("usuarioId"));
  if (!usuarioId.success) return { erro: "Usuário inválido." };

  if (usuarioId.data === autor.id) {
    return { erro: "Você não pode desativar a própria conta." };
  }

  const alvo = await prisma.usuario.findUnique({
    where: { id: usuarioId.data },
    select: { ativo: true, nome: true },
  });
  if (!alvo) return { erro: "Usuário não encontrado." };

  if (alvo.ativo) {
    const impedimento = await impedeSeForUltimoAdmin(usuarioId.data);
    if (impedimento) return { erro: impedimento };
  }

  // Nada é apagado: desativar é mudança de status. A linha continua, com o
  // histórico de tudo que a pessoa lançou.
  //
  // O acesso morre aqui e não no Supabase Auth de propósito: `usuarioAtual`
  // confere `ativo` a cada requisição, então a sessão que já estava aberta para
  // de valer na requisição seguinte. Banir também no Auth criaria um segundo
  // interruptor que pode discordar deste.
  await prisma.usuario.update({
    where: { id: usuarioId.data },
    data: { ativo: !alvo.ativo },
  });

  revalidatePath("/config/usuarios");
  return {
    ok: alvo.ativo
      ? `${alvo.nome} desativado. O acesso cai na próxima requisição.`
      : `${alvo.nome} reativado.`,
  };
}

const esquemaSenha = z.object({
  usuarioId: z.uuid(),
  senha: z.string().min(8, { error: "A senha precisa de ao menos 8 caracteres." }),
});

/** Redefinição de senha pelo admin — o app não manda e-mail de recuperação. */
export async function redefinirSenha(
  _estado: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  await exigirPapeis(SOMENTE_ADMIN);

  const analise = esquemaSenha.safeParse({
    usuarioId: dados.get("usuarioId"),
    senha: dados.get("senha"),
  });
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const alvo = await prisma.usuario.findUnique({
    where: { id: analise.data.usuarioId },
    select: { authUserId: true, nome: true },
  });
  if (!alvo?.authUserId) return { erro: "Usuário sem acesso vinculado." };

  const supabase = criarClienteAdmin();
  const { error } = await supabase.auth.admin.updateUserById(alvo.authUserId, {
    password: analise.data.senha,
  });
  if (error) return { erro: `Não foi possível trocar a senha: ${error.message}` };

  return { ok: `Senha de ${alvo.nome} redefinida.` };
}

/**
 * Impede o projeto de ficar sem nenhum admin ativo — estado do qual não se sai
 * pela tela, só por acesso direto ao banco.
 */
async function impedeSeForUltimoAdmin(usuarioId: string): Promise<string | null> {
  const outrosAdmins = await prisma.usuario.count({
    where: {
      id: { not: usuarioId },
      ativo: true,
      papeis: { has: Papel.ADMIN },
    },
  });
  return outrosAdmins > 0
    ? null
    : "Este é o único administrador ativo. Promova outro antes.";
}

/**
 * Exclui um usuário que nunca registrou nada (decisão de 2026-10-04): a linha
 * em Usuario e o login no Supabase Auth. Quem tem qualquer registro de autoria
 * só pode ser desativado — ver lib/usuarios.ts.
 *
 * A linha é travada antes de contar: um registro novo apontando para ela
 * (chave estrangeira) espera esta transação e, depois do DELETE, falha em vez
 * de nascer sem autor.
 */
export async function excluirUsuario(
  _estado: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  const autor = await exigirPapeis(SOMENTE_ADMIN);

  const usuarioId = z.uuid().safeParse(dados.get("usuarioId"));
  if (!usuarioId.success) return { erro: "Usuário inválido." };

  const resultado = await prisma.$transaction(
    async (tx): Promise<EstadoForm & { authUserId?: string | null; nome?: string }> => {
      const travado = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Usuario" WHERE id = ${usuarioId.data}::uuid FOR UPDATE`;
      if (travado.length === 0) return { erro: "Usuário não encontrado." };

      const alvo = await tx.usuario.findUniqueOrThrow({
        where: { id: usuarioId.data },
        select: {
          nome: true,
          ativo: true,
          papeis: true,
          authUserId: true,
          _count: { select: CONTAGEM_DE_AUTORIA },
        },
      });
      const outrosAdmins =
        alvo.ativo && alvo.papeis.includes(Papel.ADMIN)
          ? await tx.usuario.count({
              where: { id: { not: usuarioId.data }, ativo: true, papeis: { has: Papel.ADMIN } },
            })
          : 1;

      const erro = erroDeExclusao({
        ehVoce: usuarioId.data === autor.id,
        ehUltimoAdminAtivo: outrosAdmins === 0,
        autoria: descreverAutoria(alvo._count),
      });
      if (erro) return { erro };

      await tx.usuario.delete({ where: { id: usuarioId.data } });
      return { authUserId: alvo.authUserId, nome: alvo.nome };
    },
  );
  if (resultado.erro) return { erro: resultado.erro };

  // O login sai depois da linha: se o Auth falhar, sobra uma conta que não
  // entra no app (usuarioAtual exige a linha em Usuario), e não o contrário.
  if (resultado.authUserId) {
    const { error } = await criarClienteAdmin().auth.admin.deleteUser(resultado.authUserId);
    if (error) {
      revalidatePath("/config/usuarios");
      return {
        erro: `${resultado.nome} saiu do app, mas o login no Supabase Auth não foi apagado (${error.message}). Ele não consegue entrar; apague pelo painel do Supabase.`,
      };
    }
  }

  revalidatePath("/config/usuarios");
  return { ok: `${resultado.nome} excluído, com o login.` };
}
