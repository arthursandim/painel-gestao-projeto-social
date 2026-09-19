/**
 * Confere as regras de domínio que o CLAUDE.md marca como as que falham em
 * silêncio: os dois cortes de idade, a escala gravada no valor da graduação e
 * os validadores de documento brasileiro.
 *
 * Não toca no banco nem na rede — lê os mesmos módulos que o app usa. Rode com
 * `npm run verifica:regras`.
 *
 * Todo caso tem par: ao lado do "não avisa" existe um "avisa", e ao lado do
 * "recusa" existe um "aceita". Sem o par, uma função que devolvesse sempre lista
 * vazia — ou sempre `false` — passaria no arquivo inteiro.
 */
import { Graduacao, ResponsavelTipo } from "@prisma/client";

import { avisosDoAluno } from "../lib/avisosAluno";
import { dataParaDia, diaParaData, idadeEm } from "../lib/data";
import { conferirEscala } from "../lib/esquemaAluno";
import {
  escalaDaGraduacao,
  escalaPorIdade,
  GRADUACOES_POR_ESCALA,
  ROTULO_GRADUACAO,
} from "../lib/graduacao";
import { formatarMatricula } from "../lib/matricula";
import { idadeCombinaComTurma, TURMA_JOVENS_ADULTOS, TURMA_KIDS } from "../lib/turma";
import {
  chaveDeNome,
  ehCepValido,
  ehCpfValido,
  ehTelefoneValido,
} from "../lib/validacoes";

let falhas = 0;

function checa(descricao: string, condicao: boolean) {
  if (condicao) {
    console.log(`  ok    ${descricao}`);
  } else {
    falhas++;
    console.error(`  FALHA ${descricao}`);
  }
}

const KIDS = { codigo: TURMA_KIDS, nome: "Kids" };
const JOVENS = { codigo: TURMA_JOVENS_ADULTOS, nome: "Jovens/Adultos" };

// =====================================================================
console.log("\nIdade em anos completos");

checa("véspera do aniversário ainda não conta", idadeEm("2014-09-20", "2026-09-19") === 11);
checa("no dia do aniversário conta", idadeEm("2014-09-20", "2026-09-20") === 12);
checa("depois do aniversário conta", idadeEm("2014-09-20", "2026-12-31") === 12);
checa("mês anterior ao aniversário", idadeEm("2014-09-20", "2026-08-31") === 11);

// 29 de fevereiro: o aniversário cai em 1º de março nos anos comuns, porque a
// comparação é de partes e 02-29 > 02-28.
checa("nascido em 29/02 em ano comum, véspera", idadeEm("2008-02-29", "2026-02-28") === 17);
checa("nascido em 29/02 em ano comum, dia seguinte", idadeEm("2008-02-29", "2026-03-01") === 18);

// =====================================================================
console.log("\nDia civil atravessa o Prisma sem perder um dia");

for (const iso of ["2026-01-01", "2014-09-20", "2008-02-29", "2026-12-31"]) {
  checa(`${iso} volta igual`, dataParaDia(diaParaData(iso)) === iso);
}
checa(
  "o Date gravado é meia-noite UTC, não meia-noite local",
  diaParaData("2014-09-20").toISOString() === "2014-09-20T00:00:00.000Z",
);

// =====================================================================
console.log("\nCorte da TURMA — aos 12 vira Jovens/Adultos");

checa("11a11m29d ainda é Kids", idadeCombinaComTurma(11, TURMA_KIDS));
checa("12 anos não é mais Kids", !idadeCombinaComTurma(12, TURMA_KIDS));
checa("12 anos cabe em Jovens/Adultos", idadeCombinaComTurma(12, TURMA_JOVENS_ADULTOS));
checa("8 anos não cabe em Jovens/Adultos", !idadeCombinaComTurma(8, TURMA_JOVENS_ADULTOS));
checa("turma desconhecida não opina", idadeCombinaComTurma(8, "COMPETICAO"));

// =====================================================================
console.log("\nCorte da ESCALA — aos 16 vira adulta (régua diferente da turma)");

checa("15 anos usa escala kids", escalaPorIdade(15) === "KIDS");
checa("16 anos usa escala adulta", escalaPorIdade(16) === "ADULTO");
checa("12 anos ainda usa escala kids", escalaPorIdade(12) === "KIDS");

checa("a escala sai do prefixo do valor", escalaDaGraduacao(Graduacao.KIDS_BRANCA) === "KIDS");
checa("branca adulta não é branca kids", escalaDaGraduacao(Graduacao.ADULTO_BRANCA) === "ADULTO");
checa(
  "toda graduação do enum está em exatamente uma escala",
  Object.values(Graduacao).every((g) => {
    const escala = escalaDaGraduacao(g);
    const outra = escala === "KIDS" ? "ADULTO" : "KIDS";
    return (
      GRADUACOES_POR_ESCALA[escala].includes(g) &&
      !GRADUACOES_POR_ESCALA[outra].includes(g)
    );
  }),
);
checa(
  "as duas escalas têm faixa branca com rótulo igual — é por isso que o prefixo existe",
  ROTULO_GRADUACAO.KIDS_BRANCA === ROTULO_GRADUACAO.ADULTO_BRANCA,
);

// =====================================================================
console.log("\nAs duas réguas juntas — o caso que mais confunde");

// O caso do CLAUDE.md: 14 anos, turma de Jovens/Adultos, faixa kids. É normal,
// e o app não pode dizer nada sobre isso.
const catorzeAnos = avisosDoAluno(
  {
    nascimento: "2012-01-15",
    graduacao: Graduacao.KIDS_VERDE,
    turma: JOVENS,
    responsavelTipo: ResponsavelTipo.MAE,
  },
  "2026-09-19",
);
checa(
  "14 anos em Jovens/Adultos com faixa kids não gera aviso nenhum",
  catorzeAnos.length === 0,
);

// Controle positivo do mesmo caso: mexer só na idade tem que acender o aviso.
const dezesseisAnos = avisosDoAluno(
  {
    nascimento: "2010-09-19",
    graduacao: Graduacao.KIDS_VERDE,
    turma: JOVENS,
    responsavelTipo: ResponsavelTipo.MAE,
  },
  "2026-09-19",
);
checa(
  "16 anos com faixa kids avisa a troca de escala",
  dezesseisAnos.some((a) => a.codigo === "ESCALA"),
);
checa(
  "…e não inventa aviso de turma junto",
  !dezesseisAnos.some((a) => a.codigo === "TURMA"),
);

// Véspera dos 16: um dia antes, silêncio.
checa(
  "15a11m29d com faixa kids ainda não avisa",
  avisosDoAluno(
    {
      nascimento: "2010-09-20",
      graduacao: Graduacao.KIDS_VERDE,
      turma: JOVENS,
      responsavelTipo: ResponsavelTipo.MAE,
    },
    "2026-09-19",
  ).length === 0,
);

// Corte da turma, nos dois dias que o separam.
checa(
  "11a11m29d em Kids não avisa",
  avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
    },
    "2026-09-19",
  ).length === 0,
);
checa(
  "no dia do aniversário de 12, avisa a troca de turma",
  avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
    },
    "2026-09-20",
  ).some((a) => a.codigo === "TURMA"),
);
checa(
  "…e o aviso de turma não arrasta um aviso de escala",
  !avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
    },
    "2026-09-20",
  ).some((a) => a.codigo === "ESCALA"),
);

// =====================================================================
console.log("\nOutros avisos do cadastro");

checa(
  "menor sem responsável legal avisa",
  avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: null,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "RESPONSAVEL"),
);
checa(
  "visão sem o campo de responsável não inventa o aviso",
  !avisosDoAluno(
    { nascimento: "2014-09-20", graduacao: Graduacao.KIDS_CINZA, turma: KIDS },
    "2026-09-19",
  ).some((a) => a.codigo === "RESPONSAVEL"),
);
checa(
  "maior de idade não cobra responsável legal",
  !avisosDoAluno(
    {
      nascimento: "2000-01-01",
      graduacao: Graduacao.ADULTO_AZUL,
      turma: JOVENS,
      responsavelTipo: null,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "RESPONSAVEL"),
);
checa(
  "acima da capacidade nomeia quem autorizou",
  avisosDoAluno(
    {
      nascimento: "2000-01-01",
      graduacao: Graduacao.ADULTO_AZUL,
      turma: JOVENS,
      responsavelTipo: null,
      acimaCapacidade: true,
      autorizacaoAcimaPor: { nome: "Fulano" },
      autorizacaoAcimaJustificativa: "Irmão de aluno.",
    },
    "2026-09-19",
  ).some((a) => a.codigo === "CAPACIDADE" && a.texto.includes("Fulano")),
);
checa(
  "nenhum aviso carrega botão de ação",
  Object.keys(
    avisosDoAluno(
      { nascimento: "2014-09-20", graduacao: Graduacao.ADULTO_AZUL, turma: KIDS },
      "2026-09-20",
    )[0] ?? {},
  ).every((chave) => chave === "codigo" || chave === "texto"),
);

// =====================================================================
console.log("\nGravar a graduação — quando recusa e quando deixa passar");

checa(
  "recusa faixa adulta para quem tem 14 anos",
  conferirEscala(Graduacao.ADULTO_AZUL, "2012-01-15") !== null,
);
checa(
  "aceita faixa kids para quem tem 14 anos",
  conferirEscala(Graduacao.KIDS_VERDE, "2012-01-15") === null,
);
checa(
  "recusa trocar para faixa kids quem já tem 16",
  conferirEscala(Graduacao.KIDS_VERDE, "2010-01-15", Graduacao.ADULTO_BRANCA) !== null,
);
// A exceção que faz o app sinalizar em vez de agir: o aluno atravessou os 16
// com a faixa kids que estava gravada. Editar o telefone dele não pode exigir
// que alguém o gradue de improviso.
checa(
  "deixa salvar a faixa kids que já estava gravada em quem fez 16",
  conferirEscala(Graduacao.KIDS_VERDE, "2010-01-15", Graduacao.KIDS_VERDE) === null,
);

// =====================================================================
console.log("\nMatrícula");

checa("primeira matrícula é A0001", formatarMatricula(1) === "A0001");
checa("quadragésima segunda é A0042", formatarMatricula(42) === "A0042");
checa("passa de quatro dígitos sem truncar", formatarMatricula(12345) === "A12345");

// =====================================================================
console.log("\nValidadores");

checa("CPF válido passa", ehCpfValido("529.982.247-25"));
checa("CPF válido sem máscara passa", ehCpfValido("52998224725"));
checa("CPF com dígito trocado é recusado", !ehCpfValido("529.982.247-26"));
checa("CPF de dígitos repetidos é recusado", !ehCpfValido("111.111.111-11"));
checa("CPF curto é recusado", !ehCpfValido("5299822472"));

checa("CEP no formato passa", ehCepValido("68900-000"));
checa("CEP sem traço passa", ehCepValido("68900000"));
checa("CEP com letra é recusado", !ehCepValido("6890A-000"));

checa("celular com DDD passa", ehTelefoneValido("(96) 99123-4567"));
checa("fixo com DDD passa", ehTelefoneValido("(96) 3223-4567"));
checa("número sem DDD é recusado", !ehTelefoneValido("99123-4567"));
checa("DDD inexistente é recusado", !ehTelefoneValido("(01) 99123-4567"));

checa(
  "nomes iguais com acento e caixa diferentes têm a mesma chave",
  chaveDeNome("José da Silva") === chaveDeNome("JOSE DA  SILVA"),
);
checa(
  "nomes diferentes têm chaves diferentes",
  chaveDeNome("José da Silva") !== chaveDeNome("José da Silveira"),
);

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} falha(s). As regras de domínio divergiram do CLAUDE.md.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
