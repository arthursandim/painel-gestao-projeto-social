/**
 * Lê a planilha preenchida, confere cada linha e grava os alunos.
 *
 * Separado do comando (scripts/importa-alunos.ts) para que a análise possa ser
 * exercitada sem planilha de verdade e a gravação, dentro de uma transação que
 * se desfaz no fim.
 *
 * Regras que vêm de decisão já tomada, não deste arquivo:
 * - a linha passa pelo mesmo `esquemaAluno` do formulário — a importação não
 *   tem régua própria, senão um aluno importado poderia ser um cadastro que a
 *   tela recusaria salvar;
 * - a planilha traz só a cor da faixa; a escala sai do nascimento;
 * - nome + nascimento já cadastrados (ou repetidos na planilha) são pulados;
 * - turma cheia exige autorização de admin com justificativa, como na tela;
 * - tudo ou nada: uma linha com erro e nenhuma é gravada.
 */
import {
  Graduacao,
  Modalidade,
  Papel,
  Prisma,
  ResponsavelTipo,
  Sexo,
  StatusAluno,
  TipoSanguineo,
  type PrismaClient,
} from "@prisma/client";
import type ExcelJS from "exceljs";

import { avisosDoAluno, IDADE_MAIORIDADE } from "../../lib/avisosAluno";
import {
  dataParaDia,
  diaParaData,
  ehDiaValido,
  hojeNoProjeto,
  idadeEm,
} from "../../lib/data";
import { esquemaAluno, type DadosAluno } from "../../lib/esquemaAluno";
import {
  escalaDoAluno,
  GRADUACOES_POR_ESCALA,
  ROTULO_ESCALA,
  ROTULO_GRADUACAO,
} from "../../lib/graduacao";
import { proximaMatricula } from "../../lib/matricula";
import { ROTULO_RESPONSAVEL_TIPO } from "../../lib/responsavel";
import { ROTULO_TIPO_SANGUINEO } from "../../lib/saude";
import { chaveDeNome, formatarCpf, somenteDigitos } from "../../lib/validacoes";
import { COLUNAS, ROTULO_MODALIDADE, ROTULO_SEXO, type Coluna } from "./colunas";

export const ABA_ALUNOS = "Alunos";

// ------------------------------------------------------------------ tipos

export type TurmaImportacao = {
  id: string;
  codigo: string;
  nome: string;
  capacidade: number;
};

export type AlunoExistente = {
  nome: string;
  nascimento: Date;
  matricula: string;
  cpf: string | null;
};

export type Autor = { id: string; nome: string; papeis: Papel[] };

export type Linha = {
  /** O número da linha no Excel, que é o que a pessoa procura para corrigir. */
  numero: number;
  nome: string;
  erros: string[];
  avisos: string[];
  /** Preenchido quando a linha não entra por já existir. Não é erro. */
  pulada?: string;
  dados?: DadosAluno;
  turma?: TurmaImportacao;
  acimaCapacidade?: boolean;
};

export type Analise = {
  /** Erro que invalida a planilha inteira, antes de olhar linha por linha. */
  erroGeral?: string;
  linhas: Linha[];
};

export type Contexto = {
  turmas: TurmaImportacao[];
  existentes: AlunoExistente[];
  /** Alunos ativos por turma hoje, para a conta da capacidade. */
  ocupacao: Map<string, number>;
  autor: Autor;
  justificativa?: string;
  hojeIso?: string;
};

// ---------------------------------------------------------- leitura de célula

/**
 * O valor da célula como texto, ou null.
 *
 * O ExcelJS devolve um tipo diferente para cada jeito de preencher: texto
 * puro, número, data, texto com formatação (`richText`), e-mail que o Excel
 * transformou em link (`hyperlink`) e fórmula (`result`). Tudo vira texto aqui,
 * e quem interpreta é o esquema — o mesmo do formulário.
 */
function textoDaCelula(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string") return valor.trim() || null;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor instanceof Date) return dataParaDia(arredondarDia(valor));
  if (typeof valor === "object") {
    if ("richText" in valor) return textoDaCelula(valor.richText.map((p) => p.text).join(""));
    if ("text" in valor) return textoDaCelula(valor.text as ExcelJS.CellValue);
    if ("result" in valor) return textoDaCelula(valor.result as ExcelJS.CellValue);
    if ("error" in valor) return `#ERRO ${valor.error}`;
  }
  return String(valor);
}

/**
 * Datas do Excel chegam como meia-noite UTC, mas a conversão do número de série
 * é de ponto flutuante e às vezes devolve 23:59:59.999 do dia anterior. Errar
 * o nascimento em um dia muda a idade na véspera do aniversário — que é onde
 * moram os cortes de 12, 16 e 18.
 */
function arredondarDia(data: Date): Date {
  const DIA = 86_400_000;
  return new Date(Math.round(data.getTime() / DIA) * DIA);
}

/** Época do número de série do Excel (o 1900 com o bug do bissexto). */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

/**
 * Data digitada de qualquer jeito razoável para `AAAA-MM-DD`.
 *
 * A célula é de data, mas quem digita "03/05/2010" numa célula que alguém
 * colou como texto produz texto. Valor que não for reconhecido volta como
 * veio, e o esquema recusa com a mensagem de data inválida.
 */
function lerData(valor: ExcelJS.CellValue): string | null {
  if (valor instanceof Date) return dataParaDia(arredondarDia(valor));
  if (typeof valor === "number") {
    return dataParaDia(arredondarDia(new Date(EPOCA_EXCEL + valor * 86_400_000)));
  }
  const texto = textoDaCelula(valor);
  if (!texto) return null;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return texto;
}

/** Comparação de opção de lista sem acento, caixa ou o sinal de menos tipográfico. */
function chaveOpcao(valor: string): string {
  return chaveDeNome(valor.replace(/[−–]/g, "-"));
}

function porRotulo<T extends string>(rotulos: Record<T, string>, valor: string): T | null {
  const chave = chaveOpcao(valor);
  for (const [codigo, rotulo] of Object.entries(rotulos) as [T, string][]) {
    if (chaveOpcao(rotulo) === chave || chaveOpcao(codigo) === chave) return codigo;
  }
  return null;
}

// --------------------------------------------------------------- cabeçalho

function cabecalhoEsperado(c: Coluna): string {
  return c.obrigatorio ? `${c.cabecalho} *` : c.cabecalho;
}

/**
 * Confere que as colunas estão onde o modelo as pôs.
 *
 * A leitura é por posição. Se alguém inserir uma coluna no meio, todas à
 * direita escorregam uma casa e o CPF vai parar no campo do órgão emissor —
 * sem erro nenhum, porque cada valor isolado continua parecendo válido. Melhor
 * recusar a planilha inteira.
 */
function conferirCabecalho(aba: ExcelJS.Worksheet): string | null {
  const linha = aba.getRow(1);
  for (const [i, c] of COLUNAS.entries()) {
    const achado = textoDaCelula(linha.getCell(i + 1).value) ?? "";
    if (chaveOpcao(achado) !== chaveOpcao(cabecalhoEsperado(c))) {
      return `A coluna ${i + 1} deveria ser "${cabecalhoEsperado(c)}" e é "${achado}". A ordem das colunas não pode mudar — gere o modelo de novo e copie os dados para ele.`;
    }
  }
  return null;
}

// --------------------------------------------------------------- uma linha

type Bruto = Record<string, ExcelJS.CellValue>;

function linhaVazia(bruto: Bruto): boolean {
  return Object.values(bruto).every((v) => textoDaCelula(v) === null);
}

/**
 * As opções das listas suspensas de volta para os códigos do banco.
 *
 * O que não está na lista vira erro aqui, com o nome da coluna. Passar o texto
 * cru adiante faria o esquema responder "Escolha o sexo." para quem escolheu —
 * só que escreveu "Masc".
 */
function converterListas(
  bruto: Bruto,
  ctx: Contexto,
  erros: string[],
): Record<string, string | null> {
  const entrada: Record<string, string | null> = {};

  for (const c of COLUNAS) {
    const valor = bruto[c.campo];
    if (c.tipo === "data") {
      entrada[c.campo] = lerData(valor);
      continue;
    }

    const texto = textoDaCelula(valor);
    entrada[c.campo] = texto;
    if (c.tipo !== "lista" || texto === null) continue;

    const fora = () =>
      erros.push(`${c.cabecalho}: "${texto}" não é uma das opções da lista.`);

    switch (c.lista) {
      case "sexo": {
        const sexo = porRotulo<Sexo>(ROTULO_SEXO, texto);
        if (!sexo) fora();
        entrada.sexo = sexo;
        break;
      }
      case "modalidade": {
        const m = porRotulo<Modalidade>(ROTULO_MODALIDADE, texto);
        if (!m) fora();
        entrada.modalidade = m;
        break;
      }
      case "responsavel": {
        const r = porRotulo<ResponsavelTipo>(ROTULO_RESPONSAVEL_TIPO, texto);
        if (!r) fora();
        entrada.responsavelTipo = r;
        break;
      }
      case "tipoSanguineo": {
        const t = porRotulo<TipoSanguineo>(ROTULO_TIPO_SANGUINEO, texto);
        if (!t) fora();
        entrada.tipoSanguineo = t;
        break;
      }
      case "turma": {
        const turma = ctx.turmas.find((t) => chaveOpcao(t.nome) === chaveOpcao(texto));
        if (!turma) fora();
        entrada.turmaId = turma?.id ?? null;
        break;
      }
      // Graduação é convertida depois, porque depende do nascimento.
      // UF e grau já chegam no formato que o esquema entende.
    }
  }

  return entrada;
}

/**
 * A cor escolhida, na escala que a data de nascimento manda.
 *
 * É aqui que "Branca" vira KIDS_BRANCA ou ADULTO_BRANCA. A escala nunca vem da
 * turma: um aluno de 13 anos em Jovens/Adultos usa faixa kids, e isso é normal.
 */
function converterGraduacao(
  cor: string | null,
  nascimento: string | null,
  ctx: Contexto,
  erros: string[],
): Graduacao | null {
  if (!cor) return null;
  if (!nascimento || !ehDiaValido(nascimento)) {
    erros.push("Graduação: corrija a data de nascimento primeiro — é ela que decide a escala da faixa.");
    return null;
  }

  const escala = escalaDoAluno(nascimento, ctx.hojeIso);
  const achada = GRADUACOES_POR_ESCALA[escala].find(
    (g) => chaveOpcao(ROTULO_GRADUACAO[g]) === chaveOpcao(cor),
  );
  if (achada) return achada;

  const existeNaOutra = Object.values(GRADUACOES_POR_ESCALA)
    .flat()
    .some((g) => chaveOpcao(ROTULO_GRADUACAO[g]) === chaveOpcao(cor));

  erros.push(
    existeNaOutra
      ? `Graduação: a faixa ${cor} não existe na escala ${ROTULO_ESCALA[escala]}, que é a desta data de nascimento (${escala === "KIDS" ? "até 15 anos" : "16 anos ou mais"}). Confira a faixa ou o nascimento.`
      : `Graduação: "${cor}" não é uma das opções da lista.`,
  );
  return null;
}

function chaveAluno(nome: string, nascimentoIso: string): string {
  return `${chaveDeNome(nome)}|${nascimentoIso}`;
}

function analisarLinha(numero: number, bruto: Bruto, ctx: Contexto): Linha {
  const erros: string[] = [];
  const avisos: string[] = [];

  const entrada = converterListas(bruto, ctx, erros);
  entrada.graduacao = converterGraduacao(entrada.graduacao, entrada.nascimento, ctx, erros);

  const linha: Linha = { numero, nome: entrada.nome ?? "(sem nome)", erros, avisos };

  const analise = esquemaAluno.safeParse(entrada);
  if (!analise.success) {
    // Um erro de lista já foi dito com o valor digitado; o "Escolha a turma."
    // que o esquema acrescentaria para o mesmo campo só repetiria.
    const jaDitos = new Set(
      COLUNAS.filter((c) => erros.some((e) => e.startsWith(`${c.cabecalho}:`))).map(
        (c) => c.campo,
      ),
    );
    for (const issue of analise.error.issues) {
      const campo = String(issue.path[0] ?? "");
      if (jaDitos.has(campo)) continue;
      const coluna = COLUNAS.find((c) => c.campo === campo);
      erros.push(coluna ? `${coluna.cabecalho}: ${issue.message}` : issue.message);
    }
    return linha;
  }

  const dados = analise.data;
  const turma = ctx.turmas.find((t) => t.id === dados.turmaId)!;
  const hoje = ctx.hojeIso ?? hojeNoProjeto();

  // O formulário não mostra os campos de responsável para o aluno adulto, que
  // assina a própria ficha. A importação não cria o que a tela não criaria.
  if (idadeEm(dados.nascimento, hoje) >= IDADE_MAIORIDADE && dados.responsavelTipo) {
    avisos.push("Responsável legal ignorado: o aluno é maior de idade e responde por si.");
    dados.responsavelTipo = null;
    dados.responsavelNome = null;
    dados.responsavelParentesco = null;
  }

  for (const aviso of avisosDoAluno({ ...dados, turma }, ctx.hojeIso)) {
    avisos.push(aviso.texto);
  }

  linha.dados = dados;
  linha.turma = turma;
  return linha;
}

// ---------------------------------------------------- a planilha inteira

/**
 * Analisa a planilha sem gravar nada.
 *
 * Não pega número de matrícula: a sequence não volta atrás, e cada teste
 * deixaria um buraco na numeração.
 */
export function analisarPlanilha(livro: ExcelJS.Workbook, ctx: Contexto): Analise {
  const aba = livro.getWorksheet(ABA_ALUNOS);
  if (!aba) return { erroGeral: `A planilha não tem a aba "${ABA_ALUNOS}".`, linhas: [] };

  const erroCabecalho = conferirCabecalho(aba);
  if (erroCabecalho) return { erroGeral: erroCabecalho, linhas: [] };

  const linhas: Linha[] = [];
  for (let numero = 2; numero <= aba.rowCount; numero++) {
    const row = aba.getRow(numero);
    const bruto: Bruto = Object.fromEntries(
      COLUNAS.map((c, i) => [c.campo, row.getCell(i + 1).value]),
    );
    if (linhaVazia(bruto)) continue;
    linhas.push(analisarLinha(numero, bruto, ctx));
  }

  conferirRepetidos(linhas, ctx);
  conferirCapacidade(linhas, ctx);

  return { linhas };
}

/**
 * Repetições — contra o banco e dentro da própria planilha.
 *
 * Nome + nascimento repetido é pulado: é o mesmo aluno, e rodar a importação
 * duas vezes não pode criar dois. Só o nome repetido avisa, como na tela —
 * dois "João Pedro da Silva" de idades diferentes existem.
 *
 * CPF repetido é erro: o banco tem índice único, e o CPF não pode ser de duas
 * pessoas.
 */
function conferirRepetidos(linhas: Linha[], ctx: Contexto) {
  const noBanco = new Map(
    ctx.existentes.map((a) => [chaveAluno(a.nome, dataParaDia(a.nascimento)), a]),
  );
  const nomesNoBanco = new Map(ctx.existentes.map((a) => [chaveDeNome(a.nome), a]));
  const cpfsNoBanco = new Map(
    ctx.existentes.filter((a) => a.cpf).map((a) => [somenteDigitos(a.cpf!), a]),
  );

  const vistas = new Map<string, Linha>();
  const nomesVistos = new Map<string, Linha>();
  const cpfsVistos = new Map<string, Linha>();

  for (const linha of linhas) {
    const dados = linha.dados;
    if (!dados) continue;

    const chave = chaveAluno(dados.nome, dados.nascimento);
    const jaCadastrado = noBanco.get(chave);
    if (jaCadastrado) {
      linha.pulada = `já cadastrado como ${jaCadastrado.matricula}`;
      continue;
    }
    const repetida = vistas.get(chave);
    if (repetida) {
      linha.pulada = `mesmo nome e nascimento da linha ${repetida.numero}`;
      continue;
    }
    vistas.set(chave, linha);

    const homonimo = nomesNoBanco.get(chaveDeNome(dados.nome));
    const homonimoAqui = nomesVistos.get(chaveDeNome(dados.nome));
    if (homonimo) {
      linha.avisos.push(`Já existe ${homonimo.nome} (${homonimo.matricula}) com este nome e outro nascimento. Confira se não é a mesma pessoa.`);
    } else if (homonimoAqui) {
      linha.avisos.push(`A linha ${homonimoAqui.numero} tem o mesmo nome e outro nascimento. Confira se não é a mesma pessoa.`);
    }
    nomesVistos.set(chaveDeNome(dados.nome), linha);

    if (dados.cpf) {
      const digitos = somenteDigitos(dados.cpf);
      const dono = cpfsNoBanco.get(digitos);
      const donoAqui = cpfsVistos.get(digitos);
      if (dono) {
        linha.erros.push(`CPF: ${formatarCpf(digitos)} já está cadastrado em ${dono.matricula}.`);
      } else if (donoAqui) {
        linha.erros.push(`CPF: ${formatarCpf(digitos)} repete o da linha ${donoAqui.numero}.`);
      } else {
        cpfsVistos.set(digitos, linha);
      }
    }
  }
}

/**
 * A regra da turma cheia, igual à da tela: não bloqueia, mas exige que um
 * admin autorize e escreva a justificativa, que fica gravada em cada aluno que
 * entrou acima do limite. Sem isso, a importação seria o caminho para encher
 * uma turma sem autorização de ninguém.
 *
 * Conta na ordem da planilha: os primeiros a caber cabem, e os seguintes são
 * os que ficam acima da capacidade.
 */
function conferirCapacidade(linhas: Linha[], ctx: Contexto) {
  const ocupacao = new Map(ctx.ocupacao);
  const ehAdmin = ctx.autor.papeis.includes(Papel.ADMIN);

  for (const linha of linhas) {
    if (!linha.dados || !linha.turma || linha.pulada) continue;
    const turma = linha.turma;
    const atual = ocupacao.get(turma.id) ?? 0;
    ocupacao.set(turma.id, atual + 1);
    if (atual < turma.capacidade) continue;

    const cheia = `A turma ${turma.nome} ficaria com ${atual + 1} alunos ativos, para ${turma.capacidade} vagas.`;
    if (!ehAdmin) {
      linha.erros.push(`${cheia} Só um administrador pode autorizar matrícula acima da capacidade.`);
    } else if (!ctx.justificativa) {
      linha.erros.push(`${cheia} Para autorizar, rode de novo com --justificativa="..."; ela fica gravada no cadastro.`);
    } else {
      linha.acimaCapacidade = true;
      linha.avisos.push(`${cheia} Entra acima da capacidade, autorizado por ${ctx.autor.nome}.`);
    }
  }
}

// ------------------------------------------------------------------ gravar

export function aGravar(analise: Analise): Linha[] {
  return analise.linhas.filter((l) => l.dados && !l.pulada && l.erros.length === 0);
}

export function temErro(analise: Analise): boolean {
  return Boolean(analise.erroGeral) || analise.linhas.some((l) => l.erros.length > 0);
}

/**
 * Grava as linhas válidas numa transação só.
 *
 * Recusa se houver qualquer erro: importar metade da planilha deixaria a
 * pessoa sem saber quais linhas entraram, e a segunda rodada — depois de
 * corrigir — teria de confiar no "pular repetido" para não duplicar.
 */
export async function gravar(
  db: PrismaClient | Prisma.TransactionClient,
  analise: Analise,
  ctx: Contexto,
): Promise<{ numero: number; matricula: string; nome: string }[]> {
  if (temErro(analise)) throw new Error("A planilha tem erros; nada foi gravado.");

  const gravados: { numero: number; matricula: string; nome: string }[] = [];
  const agora = new Date();

  for (const linha of aGravar(analise)) {
    const { nascimento, graduacaoData, rgDataEmissao, ...resto } = linha.dados!;
    const matricula = await proximaMatricula(db);

    await db.aluno.create({
      data: {
        ...resto,
        nascimento: diaParaData(nascimento),
        graduacaoData: graduacaoData ? diaParaData(graduacaoData) : null,
        rgDataEmissao: rgDataEmissao ? diaParaData(rgDataEmissao) : null,
        status: StatusAluno.ATIVO,
        matricula,
        criadoPorId: ctx.autor.id,
        atualizadoPorId: ctx.autor.id,
        ...(linha.acimaCapacidade
          ? {
              acimaCapacidade: true,
              autorizacaoAcimaPorId: ctx.autor.id,
              autorizacaoAcimaEm: agora,
              autorizacaoAcimaJustificativa: ctx.justificativa!,
            }
          : {}),
      },
    });
    gravados.push({ numero: linha.numero, matricula, nome: linha.nome });
  }

  return gravados;
}
