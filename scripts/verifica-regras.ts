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
import { interpretarRespostaViaCep, mascaraCep } from "../lib/cep";
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
  formatarTelefone,
  mascaraTelefone,
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
  "menor sem escola vira pendência",
  avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
      escola: null,
      serie: null,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "ESCOLA"),
);
checa(
  "menor com escola mas sem série também vira pendência",
  avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
      escola: "Escola Municipal X",
      serie: null,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "ESCOLA"),
);
checa(
  "menor com escola e série não gera pendência",
  !avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
      escola: "Escola Municipal X",
      serie: "6º ano",
    },
    "2026-09-19",
  ).some((a) => a.codigo === "ESCOLA"),
);

// O corte dos 18: nada de escola nem de responsável é cobrado do adulto.
const adultoSemNada = avisosDoAluno(
  {
    nascimento: "2000-01-01",
    graduacao: Graduacao.ADULTO_AZUL,
    turma: JOVENS,
    responsavelTipo: null,
    escola: null,
    serie: null,
  },
  "2026-09-19",
);
checa("adulto sem escola não é cobrado", !adultoSemNada.some((a) => a.codigo === "ESCOLA"));
checa(
  "adulto sem responsável não é cobrado",
  !adultoSemNada.some((a) => a.codigo === "RESPONSAVEL"),
);
checa("adulto em dia não gera aviso nenhum", adultoSemNada.length === 0);

// Véspera dos 18: um dia antes, as duas cobranças ainda valem.
const vesperaDos18 = avisosDoAluno(
  {
    nascimento: "2008-09-20",
    graduacao: Graduacao.ADULTO_AZUL,
    turma: JOVENS,
    responsavelTipo: null,
    escola: null,
    serie: null,
  },
  "2026-09-19",
);
checa(
  "17a11m29d ainda é cobrado de escola",
  vesperaDos18.some((a) => a.codigo === "ESCOLA"),
);
checa(
  "17a11m29d ainda é cobrado de responsável",
  vesperaDos18.some((a) => a.codigo === "RESPONSAVEL"),
);

// A visão reduzida do professor não traz escola: a pendência não pode ser
// inventada a partir de um campo que a consulta nem leu.
checa(
  "visão sem escola não inventa a pendência",
  !avisosDoAluno(
    {
      nascimento: "2014-09-20",
      graduacao: Graduacao.KIDS_CINZA,
      turma: KIDS,
      responsavelTipo: ResponsavelTipo.MAE,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "ESCOLA"),
);

// Ficha de menor aos 18 só acende quando a fase 5 souber dizer qual ficha está
// vigente. Sem isso, todo aluno adulto carregaria um aviso permanente.
checa(
  "sem dado de documento, maioridade não gera aviso de ficha",
  !adultoSemNada.some((a) => a.codigo === "FICHA_MAIORIDADE"),
);
checa(
  "com ficha de menor vigente, o aviso acende",
  avisosDoAluno(
    {
      nascimento: "2000-01-01",
      graduacao: Graduacao.ADULTO_AZUL,
      turma: JOVENS,
      responsavelTipo: null,
      escola: null,
      serie: null,
      temFichaMenorVigente: true,
    },
    "2026-09-19",
  ).some((a) => a.codigo === "FICHA_MAIORIDADE"),
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

console.log("\nMáscara de telefone — tudo é gravado no mesmo formato");

checa(
  "celular cru vira (96) 99123-4567",
  formatarTelefone("96991234567") === "(96) 99123-4567",
);
checa(
  "fixo cru vira (96) 3223-4567",
  formatarTelefone("9632234567") === "(96) 3223-4567",
);
checa(
  "número já formatado não muda",
  formatarTelefone("(96) 99123-4567") === "(96) 99123-4567",
);
checa(
  "formatar é idempotente",
  formatarTelefone(formatarTelefone("96991234567")) === "(96) 99123-4567",
);

// A máscara progressiva, tecla a tecla.
for (const [digitado, esperado] of [
  ["", ""],
  ["9", "(9"],
  ["96", "(96"],
  ["969", "(96) 9"],
  ["969912", "(96) 9912"],
  ["9699123456", "(96) 9912-3456"],
  ["96991234567", "(96) 99123-4567"],
  ["969912345678999", "(96) 99123-4567"],
] as const) {
  checa(
    `máscara de "${digitado}" é "${esperado}"`,
    mascaraTelefone(digitado) === esperado,
  );
}
checa(
  "colar um número com +55 e pontos ainda funciona",
  mascaraTelefone("96.99123.4567") === "(96) 99123-4567",
);

console.log("\nResposta da ViaCEP");

// A ViaCEP responde 200 mesmo para CEP inexistente, sinalizando no corpo.
// Quem confiar no status HTTP preenche o endereço com quatro strings vazias e
// não percebe — daí este bloco existir sem tocar na rede.
// Corpo copiado de uma resposta real de 68900-060, campos e tudo.
const encontrado = interpretarRespostaViaCep({
  cep: "68900-060",
  logradouro: "Avenida Mendonça Furtado",
  complemento: "até 2069/2070",
  unidade: "",
  bairro: "Central",
  localidade: "Macapá",
  uf: "AP",
  estado: "Amapá",
  regiao: "Norte",
  ibge: "1600303",
  ddd: "96",
});
checa("CEP válido é aceito", encontrado.ok);
checa(
  "localidade vira cidade",
  encontrado.ok && encontrado.endereco.cidade === "Macapá",
);
// A ViaCEP manda `uf: "AP"` e `estado: "Amapá"` na mesma resposta, e o nosso
// campo se chama "estado". Ler o campo de nome igual gravaria "Amapá" numa
// coluna Char(2) — o banco truncaria para "Am" ou recusaria, dependendo do
// humor, e ninguém ligaria uma coisa à outra.
checa(
  'o estado vem de "uf", não do campo "estado" da ViaCEP',
  encontrado.ok && encontrado.endereco.estado === "AP",
);
checa(
  "logradouro e bairro vêm junto",
  encontrado.ok &&
    encontrado.endereco.logradouro === "Avenida Mendonça Furtado" &&
    encontrado.endereco.bairro === "Central",
);

checa(
  "erro booleano é CEP não encontrado",
  interpretarRespostaViaCep({ erro: true }).ok === false,
);
// A mesma API já devolveu o campo como string conforme a versão. Testar só o
// booleano deixaria passar a outra forma, e o formulário apagaria o endereço.
checa(
  'erro como string "true" também é CEP não encontrado',
  interpretarRespostaViaCep({ erro: "true" }).ok === false,
);
checa(
  "corpo vazio não é aceito como endereço",
  interpretarRespostaViaCep({}).ok === false,
);
checa(
  "resposta que não é objeto não quebra",
  interpretarRespostaViaCep("pagina de erro em html").ok === false,
);
checa("null não quebra", interpretarRespostaViaCep(null).ok === false);

// CEP de rua inteira não traz logradouro, e isso é resultado bom: cidade e UF
// valem, e a pessoa completa a rua à mão.
const ruaInteira = interpretarRespostaViaCep({
  cep: "68900-000",
  logradouro: "",
  bairro: "",
  localidade: "Macapá",
  uf: "AP",
});
checa("CEP de cidade inteira ainda preenche cidade e UF", ruaInteira.ok);
checa(
  "…e deixa logradouro em branco para preenchimento à mão",
  ruaInteira.ok && ruaInteira.endereco.logradouro === "",
);

console.log("\nMáscara de CEP");
for (const [digitado, esperado] of [
  ["", ""],
  ["689", "689"],
  ["68900", "68900"],
  ["689000", "68900-0"],
  ["68900000", "68900-000"],
  ["68900-000", "68900-000"],
  ["6890000012345", "68900-000"],
] as const) {
  checa(`máscara de "${digitado}" é "${esperado}"`, mascaraCep(digitado) === esperado);
}

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
