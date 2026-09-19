import { randomBytes } from "node:crypto";

import { PrismaClient, Papel } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} no .env.local.`);
  return valor;
}

/**
 * Encontra o usuário do Supabase Auth com este e-mail, ou cria um.
 *
 * O SDK não tem busca por e-mail, só listagem paginada — o que é aceitável num
 * projeto de ~10 contas. A ordem é tentar criar primeiro: se o e-mail já
 * existir, o Auth recusa e aí a listagem encontra o id. Assim rodar o seed
 * duas vezes não troca a senha de quem já está usando o sistema.
 */
async function acharOuCriarAuthUser(
  supabase: SupabaseClient,
  email: string,
  senha: string,
): Promise<{ id: string; criado: boolean }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (!error && data.user) return { id: data.user.id, criado: true };

  const jaExiste =
    error?.code === "email_exists" ||
    (error?.message ?? "").toLowerCase().includes("already been registered");
  if (!jaExiste) {
    throw new Error(`Falha ao criar o acesso de ${email}: ${error?.message}`);
  }

  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data: lista, error: erroLista } =
      await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (erroLista) throw new Error(erroLista.message);
    const achado = lista.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (achado) return { id: achado.id, criado: false };
    if (lista.users.length < 200) break;
  }

  throw new Error(
    `O Auth diz que ${email} já existe, mas ele não apareceu na listagem.`,
  );
}

async function main() {
  const turmas = await Promise.all([
    prisma.turma.upsert({
      where: { codigo: "KIDS" },
      update: {},
      create: { codigo: "KIDS", nome: "Kids", capacidade: 40 },
    }),
    prisma.turma.upsert({
      where: { codigo: "JOVENS_ADULTOS" },
      update: {},
      create: {
        codigo: "JOVENS_ADULTOS",
        nome: "Jovens/Adultos",
        capacidade: 40,
      },
    }),
  ]);

  const email = exigirEnv("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const nome = exigirEnv("SEED_ADMIN_NOME");

  // Sem senha no ambiente, o seed sorteia uma e imprime uma única vez. É
  // melhor do que uma senha padrão em código, que nasceria conhecida.
  const senhaDoEnv = process.env.SEED_ADMIN_SENHA;
  const senha = senhaDoEnv ?? randomBytes(12).toString("base64url");

  const supabase = createClient(
    exigirEnv("NEXT_PUBLIC_SUPABASE_URL"),
    exigirEnv("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const acesso = await acharOuCriarAuthUser(supabase, email, senha);

  // O authUserId é o vínculo entre a conta do Auth e a linha de Usuario, e é a
  // única coisa que `usuarioAtual` consulta para saber de quem é a sessão. Sem
  // ele preenchido, o login acontece no Supabase e o app não reconhece ninguém.
  const admin = await prisma.usuario.upsert({
    where: { email },
    update: { papeis: [Papel.ADMIN], ativo: true, authUserId: acesso.id },
    create: { nome, email, papeis: [Papel.ADMIN], authUserId: acesso.id },
  });

  await prisma.configuracao.upsert({
    where: { chave: "faltas_consecutivas_alerta" },
    update: {},
    create: {
      chave: "faltas_consecutivas_alerta",
      valor: "3",
      descricao:
        "Faltas consecutivas que colocam o aluno no card de risco de evasão.",
    },
  });

  console.log(
    `Turmas: ${turmas.map((t) => `${t.nome} (${t.capacidade})`).join(", ")}`,
  );
  console.log(`Admin: ${admin.nome} <${admin.email}> — auth ${acesso.id}`);

  if (acesso.criado && !senhaDoEnv) {
    console.log(`\nSenha inicial sorteada: ${senha}`);
    console.log("Anote agora: ela não é gravada em lugar nenhum.\n");
  } else if (!acesso.criado) {
    console.log("O acesso já existia; a senha atual foi preservada.");
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
