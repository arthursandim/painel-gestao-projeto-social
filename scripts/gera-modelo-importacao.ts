/**
 * Gera a planilha modelo para importar os alunos já matriculados em papel.
 *
 *   npm run importacao:modelo
 *
 * Sai em importacao/modelo-alunos.xlsx. A pasta está no .gitignore: o modelo em
 * si não tem dado pessoal, mas é ali que a planilha preenchida vai morar, e ela
 * tem CPF, endereço e saúde de menores.
 *
 * As turmas da lista suspensa vêm do banco, e não de uma constante, porque é
 * pelo nome que a importação vai achar a turma — e o nome é o que está gravado.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

import { COLUNAS, listas, type NomeLista } from "./importacao/colunas";

/** Linhas preparadas com lista suspensa e formato. Folga sobre os ~80 alunos. */
const LINHAS = 300;

/**
 * Gerar de novo não pode apagar uma planilha já preenchida — e o caminho
 * natural é preencher o próprio modelo, que é também o arquivo que a
 * importação lê por padrão. O arquivo existente só é substituído com
 * --sobrescrever; --saida=caminho.xlsx grava em outro lugar.
 */
const SAIDA =
  process.argv.find((a) => a.startsWith("--saida="))?.slice("--saida=".length) ??
  path.join("importacao", "modelo-alunos.xlsx");

const COR_CABECALHO = "FF16130F";
const COR_OBRIGATORIO = "FF8A5A00";

function letra(indice: number): string {
  let n = indice;
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function abaInstrucoes(livro: ExcelJS.Workbook) {
  const aba = livro.addWorksheet("Instruções");
  aba.getColumn(1).width = 110;

  const linhas: [string, "titulo" | "secao" | "texto"][] = [
    ["Importação de alunos — Engenho Cidadão", "titulo"],
    ["", "texto"],
    ["Como preencher", "secao"],
    ["• Uma linha por aluno, na aba Alunos. Não mude a ordem nem o nome das colunas.", "texto"],
    ["• As colunas com * (em laranja) são obrigatórias: nome, nascimento, sexo, turma, modalidade, graduação e grau.", "texto"],
    ["• Todo o resto pode ficar em branco. É melhor deixar vazio do que inventar: o app mostra o que falta como pendência.", "texto"],
    ["• Onde houver lista suspensa, escolha da lista. Valor digitado fora dela é recusado pela planilha.", "texto"],
    ["• Datas no formato dd/mm/aaaa.", "texto"],
    ["• Passe o mouse sobre o cabeçalho de uma coluna para ver a observação dela, quando houver.", "texto"],
    ["", "texto"],
    ["Graduação", "secao"],
    ["• Escolha só a cor. A escala (Kids ou Adulto) é decidida pela data de nascimento: até 15 anos, Kids; a partir de 16, Adulto. No ano em que faz 16 valem as duas.", "texto"],
    ["• Um aluno de 12 a 15 anos pode estar na turma Jovens/Adultos com faixa kids. Isso é normal.", "texto"],
    ["• Cor que não existe na escala da idade (ex.: Azul para 10 anos) é recusada na importação, com o motivo.", "texto"],
    ["", "texto"],
    ["Responsável legal", "secao"],
    ["• Pai ou Mãe: o nome vem da coluna Nome do pai ou Nome da mãe, que precisa estar preenchida.", "texto"],
    ["• Outro: preencha também o nome e o parentesco do outro responsável (avó, tio, guardião…).", "texto"],
    ["", "texto"],
    ["O que acontece na importação", "secao"],
    ["• Primeiro roda um teste, sem gravar nada, que lista linha a linha o que precisa ser corrigido.", "texto"],
    ["• Aluno com o mesmo nome e a mesma data de nascimento de um já cadastrado não é importado de novo.", "texto"],
    ["• A matrícula (A0001, A0002…) é gerada pelo app. Não existe coluna para ela.", "texto"],
    ["• Documentos digitalizados e foto não entram por aqui: são enviados depois, pelo cadastro de cada aluno.", "texto"],
    ["", "texto"],
    ["Cuidado com este arquivo", "secao"],
    ["• Ele guarda dados pessoais e de saúde de crianças. Não envie por WhatsApp nem por e-mail, e não deixe em pasta compartilhada.", "texto"],
    ["• Depois da importação conferida, apague as cópias.", "texto"],
  ];

  for (const [texto, estilo] of linhas) {
    const linha = aba.addRow([texto]);
    const celula = linha.getCell(1);
    celula.alignment = { wrapText: true, vertical: "top" };
    if (estilo === "titulo") celula.font = { bold: true, size: 14 };
    if (estilo === "secao") celula.font = { bold: true, size: 12 };
  }
}

function abaListas(livro: ExcelJS.Workbook, opcoes: Record<NomeLista, readonly string[]>) {
  const aba = livro.addWorksheet("Listas", { state: "hidden" });
  const referencias = {} as Record<NomeLista, string>;

  (Object.keys(opcoes) as NomeLista[]).forEach((nome, i) => {
    const coluna = letra(i + 1);
    aba.getCell(`${coluna}1`).value = nome;
    opcoes[nome].forEach((valor, j) => {
      const celula = aba.getCell(`${coluna}${j + 2}`);
      celula.value = valor;
      celula.numFmt = "@";
    });
    referencias[nome] = `Listas!$${coluna}$2:$${coluna}$${opcoes[nome].length + 1}`;
  });

  return referencias;
}

function abaAlunos(livro: ExcelJS.Workbook, referencias: Record<NomeLista, string>) {
  const aba = livro.addWorksheet("Alunos", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });

  aba.columns = COLUNAS.map((c) => ({
    header: c.obrigatorio ? `${c.cabecalho} *` : c.cabecalho,
    key: c.campo,
    width: c.largura,
  }));

  const cabecalho = aba.getRow(1);
  cabecalho.height = 32;
  COLUNAS.forEach((c, i) => {
    const celula = cabecalho.getCell(i + 1);
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: c.obrigatorio ? COR_OBRIGATORIO : COR_CABECALHO },
    };
    celula.alignment = { vertical: "middle", wrapText: true };
    if (c.nota) celula.note = c.nota;
  });

  COLUNAS.forEach((c, i) => {
    const coluna = i + 1;
    for (let linha = 2; linha <= LINHAS + 1; linha++) {
      const celula = aba.getCell(linha, coluna);

      if (c.tipo === "texto") celula.numFmt = "@";

      if (c.tipo === "data") {
        celula.numFmt = "dd/mm/yyyy";
        celula.dataValidation = {
          type: "date",
          operator: "greaterThan",
          allowBlank: true,
          formulae: [new Date(Date.UTC(1900, 0, 1))],
          showErrorMessage: true,
          errorTitle: c.cabecalho,
          error: "Informe uma data no formato dd/mm/aaaa.",
        };
      }

      if (c.tipo === "decimal") {
        celula.numFmt = "0.00";
        celula.dataValidation = {
          type: "decimal",
          operator: "greaterThan",
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorTitle: c.cabecalho,
          error: "Informe um número. Use vírgula para as casas decimais.",
        };
      }

      if (c.tipo === "lista" && c.lista) {
        celula.numFmt = "@";
        celula.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [referencias[c.lista]],
          showErrorMessage: true,
          errorTitle: c.cabecalho,
          error: "Escolha uma das opções da lista.",
        };
      }
    }
  });
}

async function main() {
  if (existsSync(SAIDA) && !process.argv.includes("--sobrescrever")) {
    throw new Error(
      `${SAIDA} já existe e pode estar preenchida. Para gerar de novo por cima, use --sobrescrever; para outro arquivo, --saida=caminho.xlsx.`,
    );
  }

  const prisma = new PrismaClient();
  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    orderBy: { criadoEm: "asc" },
    select: { nome: true },
  });
  await prisma.$disconnect();

  if (turmas.length === 0) throw new Error("Nenhuma turma ativa no banco.");

  const livro = new ExcelJS.Workbook();
  livro.creator = "Engenho Cidadão";

  abaInstrucoes(livro);
  const referencias = abaListas(livro, listas(turmas.map((t) => t.nome)));
  abaAlunos(livro, referencias);

  // A aba de dados abre primeiro; as instruções ficam a um clique.
  livro.views = [{ activeTab: 2, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  mkdirSync(path.dirname(SAIDA), { recursive: true });
  await livro.xlsx.writeFile(SAIDA);

  console.log(`Modelo gerado em ${SAIDA}`);
  console.log(`Turmas na lista: ${turmas.map((t) => t.nome).join(", ")}`);
  console.log(`${COLUNAS.length} colunas, ${LINHAS} linhas preparadas.`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
