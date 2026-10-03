/**
 * Importa os alunos já matriculados em papel, a partir da planilha modelo.
 *
 *   npm run importacao:alunos                      teste, sem gravar nada
 *   npm run importacao:alunos -- --gravar          grava
 *
 * Opções:
 *   --arquivo=caminho.xlsx    padrão: importacao/modelo-alunos.xlsx
 *   --autor=email             quem fica como autor do cadastro; padrão:
 *                             SEED_ADMIN_EMAIL do .env.local
 *   --justificativa="..."     autoriza entrar acima da capacidade da turma
 *                             (só admin); fica gravada em cada aluno excedente
 *
 * Sem --gravar é sempre teste: lista linha a linha o que entra, o que é pulado
 * e o que precisa ser corrigido. Com --gravar, qualquer erro cancela tudo.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { existsSync } from "node:fs";
import path from "node:path";

import { PrismaClient, StatusAluno } from "@prisma/client";
import ExcelJS from "exceljs";

import { PAPEIS_ESCRITA_ALUNO } from "../lib/permissoes";
import {
  aGravar,
  analisarPlanilha,
  gravar,
  temErro,
  type Analise,
  type Contexto,
} from "./importacao/importacao";

const ARQUIVO_PADRAO = path.join("importacao", "modelo-alunos.xlsx");

function opcao(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function relatorio(analise: Analise) {
  if (analise.erroGeral) {
    console.error(`\nERRO NA PLANILHA: ${analise.erroGeral}\n`);
    return;
  }

  for (const linha of analise.linhas) {
    const cabeca = `Linha ${linha.numero} — ${linha.nome}`;
    if (linha.pulada) {
      console.log(`  pula  ${cabeca}: ${linha.pulada}`);
    } else if (linha.erros.length > 0) {
      console.log(`  ERRO  ${cabeca}`);
      for (const e of linha.erros) console.log(`          ✗ ${e}`);
    } else {
      console.log(`  ok    ${cabeca}`);
    }
    if (!linha.pulada) {
      for (const a of linha.avisos) console.log(`          · ${a}`);
    }
  }

  const comErro = analise.linhas.filter((l) => l.erros.length > 0).length;
  const puladas = analise.linhas.filter((l) => l.pulada).length;
  console.log(
    `\n${analise.linhas.length} linha(s) preenchida(s): ${aGravar(analise).length} a importar, ${puladas} pulada(s), ${comErro} com erro.`,
  );
}

async function main() {
  const gravarDeVerdade = process.argv.includes("--gravar");
  const arquivo = opcao("arquivo") ?? ARQUIVO_PADRAO;
  const emailAutor = opcao("autor") ?? process.env.SEED_ADMIN_EMAIL;
  const justificativa = opcao("justificativa")?.trim() || undefined;

  if (!existsSync(arquivo)) throw new Error(`Arquivo não encontrado: ${arquivo}`);
  if (!emailAutor) throw new Error("Informe --autor=email ou defina SEED_ADMIN_EMAIL no .env.local.");

  const prisma = new PrismaClient();
  try {
    const autor = await prisma.usuario.findUnique({
      where: { email: emailAutor },
      select: { id: true, nome: true, papeis: true, ativo: true },
    });
    if (!autor || !autor.ativo) throw new Error(`Usuário ativo não encontrado: ${emailAutor}`);
    if (!autor.papeis.some((p) => PAPEIS_ESCRITA_ALUNO.includes(p))) {
      throw new Error(`${emailAutor} não tem papel que cadastre aluno (Administração ou Inscrições).`);
    }

    const [turmas, existentes, contagem] = await Promise.all([
      prisma.turma.findMany({
        where: { ativa: true },
        select: { id: true, codigo: true, nome: true, capacidade: true },
      }),
      prisma.aluno.findMany({
        select: { nome: true, nascimento: true, matricula: true, cpf: true },
      }),
      prisma.aluno.groupBy({
        by: ["turmaId"],
        where: { status: StatusAluno.ATIVO },
        _count: true,
      }),
    ]);

    const ctx: Contexto = {
      turmas,
      existentes,
      ocupacao: new Map(contagem.map((c) => [c.turmaId, c._count])),
      autor,
      justificativa,
    };

    const livro = new ExcelJS.Workbook();
    await livro.xlsx.readFile(arquivo);

    console.log(`\n${gravarDeVerdade ? "IMPORTAÇÃO" : "TESTE (nada é gravado)"} — ${arquivo}`);
    console.log(`Autor: ${autor.nome}\n`);

    const analise = analisarPlanilha(livro, ctx);
    relatorio(analise);

    if (temErro(analise)) {
      console.error("\nCorrija os erros acima e rode de novo. Nada foi gravado.");
      process.exitCode = 1;
      return;
    }

    if (aGravar(analise).length === 0) {
      console.log("\nNada a importar.");
      return;
    }

    if (!gravarDeVerdade) {
      console.log("\nNada foi gravado. Para gravar: npm run importacao:alunos -- --gravar");
      return;
    }

    const gravados = await prisma.$transaction((tx) => gravar(tx, analise, ctx), {
      timeout: 120_000,
    });

    console.log(`\n${gravados.length} aluno(s) importado(s):`);
    for (const g of gravados) console.log(`  ${g.matricula}  linha ${g.numero} — ${g.nome}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
