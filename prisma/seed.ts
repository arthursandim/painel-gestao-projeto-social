import { PrismaClient, Papel } from "@prisma/client";

const prisma = new PrismaClient();

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

  const email = process.env.SEED_ADMIN_EMAIL;
  const nome = process.env.SEED_ADMIN_NOME;
  if (!email || !nome) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_NOME no .env");
  }

  const admin = await prisma.usuario.upsert({
    where: { email },
    update: { papeis: [Papel.ADMIN], ativo: true },
    create: { nome, email, papeis: [Papel.ADMIN] },
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
  console.log(`Admin: ${admin.nome} <${admin.email}>`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
