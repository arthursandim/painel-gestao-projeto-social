/**
 * Limpeza do banco, interativa.
 *
 *   npm run banco:limpar                      ambiente dev (.env.local)
 *   npm run banco:limpar -- --ambiente=prd    produção (.env.production.local)
 *   npm run banco:limpar -- --listar          só mostra o que existe, sem perguntar
 *
 * Mostra quanto existe em cada grupo, pergunta o que apagar, mostra o plano
 * final e só executa depois de a pessoa digitar o identificador do projeto
 * Supabase — o mesmo que aparece na URL do painel. Sem terminal interativo,
 * não roda.
 *
 * Nunca apaga Turma, Configuracao nem Usuario (nem o vínculo com o Supabase
 * Auth). Ver "Banco único e limpeza" no CLAUDE.md.
 *
 * Não contraria "Nada é apagado": aquela regra vale para o uso do app. Isto é
 * remoção de dado de teste, decidida por uma pessoa, com o plano na tela.
 */
import { existsSync } from "node:fs";
import { stdin, stdout } from "node:process";
import * as readline from "node:readline/promises";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  AMBIENTES,
  GRUPOS,
  interpretarEscolha,
  lerAmbiente,
  montarPlano,
  projetoDaUrl,
  type Pasta,
  type Tabela,
} from "./limpeza/plano";

const ambiente = lerAmbiente(process.argv.slice(2));
if (!ambiente) {
  console.error("Use --ambiente=dev ou --ambiente=prd.");
  process.exit(1);
}
const arquivoEnv = AMBIENTES[ambiente];
if (!existsSync(arquivoEnv)) {
  console.error(
    `${arquivoEnv} não existe. Para --ambiente=${ambiente}, crie o arquivo com DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do projeto certo.`,
  );
  process.exit(1);
}
// override: um DATABASE_URL já exportado no terminal não pode decidir o alvo
// no lugar do arquivo escolhido.
config({ path: arquivoEnv, quiet: true, override: true });

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.SUPABASE_SECRET_KEY ?? "";
const projeto = projetoDaUrl(urlSupabase);
if (!process.env.DATABASE_URL || !chave || !projeto) {
  console.error(`${arquivoEnv} precisa de DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL (*.supabase.co) e SUPABASE_SECRET_KEY.`);
  process.exit(1);
}
const soListar = process.argv.includes("--listar");
if (!soListar && !stdin.isTTY) {
  console.error("O banco:limpar só roda num terminal interativo: ele pergunta antes de apagar. Para só ver o que existe, use --listar.");
  process.exit(1);
}

// Instanciado depois do dotenv: o Prisma lê DATABASE_URL aqui, não no import.
const prisma = new PrismaClient();
const supabase = createClient(urlSupabase, chave, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const rl = readline.createInterface({ input: stdin, output: stdout });

// ---------------------------------------------------------------- contagem

async function contar(): Promise<Record<Tabela, number>> {
  const [emprestimo, presenca, documento, movimento, espera, convertidos, item, aluno] =
    await Promise.all([
      prisma.emprestimo.count(),
      prisma.presenca.count(),
      prisma.documento.count(),
      prisma.movimentoEstoque.count(),
      prisma.listaEspera.count(),
      prisma.listaEspera.count({ where: { alunoId: { not: null } } }),
      prisma.item.count(),
      prisma.aluno.count(),
    ]);
  return {
    Emprestimo: emprestimo,
    Presenca: presenca,
    Documento: documento,
    MovimentoEstoque: movimento,
    ListaEspera: espera,
    ListaEsperaConvertidos: convertidos,
    Item: item,
    Aluno: aluno,
  };
}

const ROTULO: Record<Tabela, string> = {
  Emprestimo: "empréstimos",
  Presenca: "presenças",
  Documento: "documentos (registros)",
  MovimentoEstoque: "movimentos de estoque",
  ListaEspera: "registros da lista de espera",
  ListaEsperaConvertidos: "registros da espera convertidos em aluno",
  Item: "itens",
  Aluno: "alunos",
};

/** Arquivos de uma pasta, recursivo. Bucket que não existe conta zero. */
async function listarArquivos(pasta: Pasta): Promise<string[] | null> {
  const caminhos: string[] = [];
  const pendentes = [pasta.prefixo];
  while (pendentes.length > 0) {
    const atual = pendentes.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage
        .from(pasta.bucket)
        .list(atual, { limit: 1000, offset });
      if (error) {
        if (/not found/i.test(error.message)) return null;
        throw error;
      }
      for (const entrada of data) {
        const caminho = `${atual}/${entrada.name}`;
        // Pasta no Storage é prefixo, sem id; arquivo tem id.
        if (entrada.id === null) pendentes.push(caminho);
        else caminhos.push(caminho);
      }
      if (data.length < 1000) break;
    }
  }
  return caminhos;
}

// -------------------------------------------------------------------- menu

async function main() {
  console.log("");
  console.log(
    ambiente === "prd"
      ? "=== LIMPEZA DO BANCO — PRODUÇÃO ==="
      : "=== Limpeza do banco — dev ===",
  );
  console.log(`Arquivo:  ${arquivoEnv}`);
  console.log(`Projeto:  ${projeto}  (${urlSupabase})`);
  console.log(`Banco:    ${new URL(process.env.DATABASE_URL!).host}`);
  console.log("");

  const contagem = await contar();
  const pastas = new Map<string, string[] | null>();
  for (const grupo of GRUPOS) {
    for (const pasta of grupo.pastas) {
      const chaveP = `${pasta.bucket}/${pasta.prefixo}`;
      if (!pastas.has(chaveP)) pastas.set(chaveP, await listarArquivos(pasta));
    }
  }
  const [turmas, configuracoes, usuarios] = await Promise.all([
    prisma.turma.count(),
    prisma.configuracao.count(),
    prisma.usuario.count(),
  ]);

  console.log("O que existe hoje, por grupo:");
  GRUPOS.forEach((grupo, i) => {
    console.log("");
    console.log(`  [${i + 1}] ${grupo.titulo}`);
    console.log(`      ${grupo.explicacao}`);
    for (const tabela of grupo.tabelas) {
      console.log(`      - ${String(contagem[tabela]).padStart(5)} ${ROTULO[tabela]}`);
    }
    for (const pasta of grupo.pastas) {
      const arquivos = pastas.get(`${pasta.bucket}/${pasta.prefixo}`);
      console.log(
        `      - ${arquivos === null ? "    —" : String(arquivos?.length ?? 0).padStart(5)} arquivos em ${pasta.bucket}/${pasta.prefixo}/${arquivos === null ? " (bucket ainda não existe)" : ""}`,
      );
    }
  });
  console.log("");
  console.log(
    `  Sempre mantidos: ${turmas} turmas (com capacidade), ${configuracoes} configurações, ${usuarios} usuários e o vínculo com o Supabase Auth.`,
  );
  console.log("");

  if (soListar) {
    console.log("Só listagem (--listar). Nada foi apagado.");
    return;
  }

  let ids: ReturnType<typeof interpretarEscolha> = null;
  while (ids === null) {
    ids = interpretarEscolha(
      await rl.question('O que apagar? Números separados por vírgula ("1,3"), "todos", ou Enter para sair: '),
    );
    if (ids === null) console.log("Não entendi. Use os números do menu.");
  }
  if (ids.length === 0) {
    console.log("Nada escolhido. Nada foi apagado.");
    return;
  }

  const plano = montarPlano(ids);
  const arquivosDoPlano = plano.pastas.flatMap(
    (p) => (pastas.get(`${p.bucket}/${p.prefixo}`) ?? []).map((c) => ({ bucket: p.bucket, caminho: c })),
  );

  console.log("");
  console.log(`Plano — ${plano.grupos.map((g) => g.titulo).join(" + ")}:`);
  for (const tabela of plano.tabelas) {
    console.log(`  apaga ${String(contagem[tabela]).padStart(5)} ${ROTULO[tabela]}`);
  }
  for (const p of plano.pastas) {
    const n = pastas.get(`${p.bucket}/${p.prefixo}`)?.length ?? 0;
    console.log(`  apaga ${String(n).padStart(5)} arquivos em ${p.bucket}/${p.prefixo}/`);
  }
  if (plano.reiniciaMatricula) console.log("  reinicia a matrícula: o próximo aluno será A0001");
  console.log("");

  const digitado = await rl.question(
    `Isto não tem volta. Para confirmar${ambiente === "prd" ? " em PRODUÇÃO" : ""}, digite o identificador do projeto (${projeto}): `,
  );
  if (digitado.trim() !== projeto) {
    console.log("Identificador diferente. Nada foi apagado.");
    return;
  }

  // ------------------------------------------------------------ execução

  // Banco numa transação só: ou sai tudo do plano, ou nada.
  await prisma.$transaction(
    async (tx) => {
      for (const tabela of plano.tabelas) {
        const { count } = await (
          {
            Emprestimo: () => tx.emprestimo.deleteMany(),
            Presenca: () => tx.presenca.deleteMany(),
            Documento: () => tx.documento.deleteMany(),
            MovimentoEstoque: () => tx.movimentoEstoque.deleteMany(),
            ListaEspera: () => tx.listaEspera.deleteMany(),
            ListaEsperaConvertidos: () =>
              tx.listaEspera.deleteMany({ where: { alunoId: { not: null } } }),
            Item: () => tx.item.deleteMany(),
            Aluno: () => tx.aluno.deleteMany(),
          } satisfies Record<Tabela, () => Promise<{ count: number }>>
        )[tabela]();
        console.log(`  apagados ${String(count).padStart(5)} ${ROTULO[tabela]}`);
      }
      if (plano.reiniciaMatricula) {
        // Apagar só as linhas deixaria a próxima matrícula seguir de onde parou.
        await tx.$executeRawUnsafe(`ALTER SEQUENCE "Aluno_matricula_seq" RESTART WITH 1`);
        console.log("  matrícula reiniciada: o próximo aluno será A0001");
      }
    },
    { timeout: 60_000 },
  );

  // Arquivos depois do banco: se o Storage falhar no meio, sobram arquivos sem
  // registro — rodar de novo e escolher o mesmo grupo termina o serviço. O
  // contrário (registro sem arquivo) não teria como ser refeito.
  for (const bucket of ["fotos", "documentos"] as const) {
    const caminhos = arquivosDoPlano.filter((a) => a.bucket === bucket).map((a) => a.caminho);
    for (let i = 0; i < caminhos.length; i += 100) {
      const lote = caminhos.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(lote);
      if (error) throw new Error(`Falha ao apagar arquivos de ${bucket}: ${error.message}. Rode de novo para terminar.`);
    }
    if (caminhos.length > 0) console.log(`  apagados ${String(caminhos.length).padStart(5)} arquivos em ${bucket}`);
  }

  const depois = await contar();
  console.log("");
  console.log("Conferência:");
  for (const tabela of plano.tabelas) {
    console.log(`  ${ROTULO[tabela]}: ${depois[tabela]}`);
  }
  console.log("Pronto.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
