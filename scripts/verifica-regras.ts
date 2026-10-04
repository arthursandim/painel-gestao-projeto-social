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
import {
  emRiscoDeEvasao,
  esquemaChamada,
  FALTAS_ALERTA_PADRAO,
  faltasConsecutivas,
  limiarFaltas,
  situacaoDoDia,
  ultimaPresenca,
} from "../lib/chamada";
import {
  dataParaDia,
  deslocarDia,
  diaParaData,
  hojeNoProjeto,
  idadeEm,
  segundaDaSemana,
} from "../lib/data";
import { conferirEscala, esquemaAluno, esquemaStatusAluno } from "../lib/esquemaAluno";
import { esquemaEspera, esquemaRemocaoEspera, ordemDaFila } from "../lib/esquemaEspera";
import {
  abaixoDoMinimo,
  contagem,
  contagensPorItem,
  decidirComEmprestimoAberto,
  esquemaItem,
  esquemaItemNovo,
} from "../lib/estoque";
import {
  TIPO_DOCUMENTO_DA_VARIANTE,
  varianteDaFicha,
  VERSAO_FICHA,
} from "../lib/ficha";
import {
  escalaDaGraduacao,
  escalaPorIdade,
  GRADUACOES_POR_ESCALA,
  ROTULO_GRADUACAO,
} from "../lib/graduacao";
import {
  INTRODUCAO_TERMO_MENOR,
  ITENS_TERMO_MENOR,
  PARAGRAFOS_CESSAO,
  PARAGRAFOS_TERMO_ADULTO,
} from "../lib/textosFicha";
import { formatarMatricula } from "../lib/matricula";
import {
  avisoCapacidadeAbaixo,
  esquemaCapacidade,
  esquemaFaltas,
  lerInteiro,
} from "../lib/parametros";
import {
  idadeCombinaComTurma,
  TURMA_JOVENS_ADULTOS,
  TURMA_KIDS,
  turmaEsperada,
} from "../lib/turma";
import {
  chaveDeNome,
  ehCepValido,
  ehCpfValido,
  ehTelefoneValido,
  formatarTelefone,
  mascaraCpf,
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

// A turma que o formulário preenche sozinho quando a data de nascimento muda.
// O corte é o dos 12 e não o dos 16: um aluno de 13 anos vai para
// Jovens/Adultos e continua com faixa kids, sem que isso seja inconsistência.
checa("11 anos sugere Kids", turmaEsperada(11) === TURMA_KIDS);
checa("no dia dos 12 sugere Jovens/Adultos", turmaEsperada(12) === TURMA_JOVENS_ADULTOS);
checa("13 anos sugere Jovens/Adultos…", turmaEsperada(13) === TURMA_JOVENS_ADULTOS);
checa(
  "…e aos 13 a escala da faixa ainda é kids (réguas diferentes)",
  escalaPorIdade(13) === "KIDS",
);
checa("40 anos sugere Jovens/Adultos", turmaEsperada(40) === TURMA_JOVENS_ADULTOS);
checa("4 anos sugere Kids", turmaEsperada(4) === TURMA_KIDS);

// A sugestão e o aviso não podem discordar: o formulário preenche a turma que
// a idade indica, e o aviso permanente cobra exatamente a mesma coisa. Se
// divergissem, o cadastro sairia com um aviso aceso no momento em que foi
// salvo — e ninguém saberia qual das duas regras está errada.
for (const idade of [0, 5, 11, 12, 13, 15, 16, 17, 18, 40]) {
  checa(
    `aos ${idade} anos, a turma sugerida não acende o aviso de turma`,
    idadeCombinaComTurma(idade, turmaEsperada(idade)),
  );
}

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
  cep: "88010-400",
  logradouro: "Rua Felipe Schmidt",
  complemento: "até 2069/2070",
  unidade: "",
  bairro: "Central",
  localidade: "Florianópolis",
  uf: "SC",
  estado: "Santa Catarina",
  regiao: "Sul",
  ibge: "4205407",
  ddd: "48",
});
checa("CEP válido é aceito", encontrado.ok);
checa(
  "localidade vira cidade",
  encontrado.ok && encontrado.endereco.cidade === "Florianópolis",
);
// A ViaCEP manda `uf: "SC"` e `estado: "Santa Catarina"` na mesma resposta, e o nosso
// campo se chama "estado". Ler o campo de nome igual gravaria "Santa Catarina" numa
// coluna Char(2) — o banco truncaria para "Sa" ou recusaria, dependendo do
// humor, e ninguém ligaria uma coisa à outra.
checa(
  'o estado vem de "uf", não do campo "estado" da ViaCEP',
  encontrado.ok && encontrado.endereco.estado === "SC",
);
checa(
  "logradouro e bairro vêm junto",
  encontrado.ok &&
    encontrado.endereco.logradouro === "Rua Felipe Schmidt" &&
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
  cep: "88010-000",
  logradouro: "",
  bairro: "",
  localidade: "Florianópolis",
  uf: "SC",
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

// =====================================================================
console.log("\nCorte da FICHA — aos 18 vira ficha de adulto");

// A TERCEIRA régua de idade do projeto. As outras duas estão acima neste
// arquivo, e o ponto destas asserções é que nenhuma serve para as outras:
//
//   12 → turma        16 → escala de graduação        18 → variante da ficha
checa("17 anos e 11 meses é ficha de MENOR", varianteDaFicha("2008-10-20", "2026-09-20") === "MENOR");
checa("véspera dos 18 ainda é MENOR", varianteDaFicha("2008-09-21", "2026-09-20") === "MENOR");
checa("no dia dos 18 vira ADULTO", varianteDaFicha("2008-09-20", "2026-09-20") === "ADULTO");
checa("no dia seguinte aos 18 é ADULTO", varianteDaFicha("2008-09-19", "2026-09-20") === "ADULTO");
checa("criança de 8 anos é MENOR", varianteDaFicha("2018-01-10", "2026-09-20") === "MENOR");
checa("adulto de 40 anos é ADULTO", varianteDaFicha("1986-01-10", "2026-09-20") === "ADULTO");

// As três réguas medidas no MESMO aluno, que é onde a confusão nasce.
const NASCIMENTO_16 = "2010-05-03"; // 16 anos em 2026-09-20
checa(
  "aos 16: escala já é adulta…",
  escalaPorIdade(idadeEm(NASCIMENTO_16, "2026-09-20")) === "ADULTO",
);
checa(
  "…a turma já é Jovens/Adultos…",
  !idadeCombinaComTurma(idadeEm(NASCIMENTO_16, "2026-09-20"), TURMA_KIDS),
);
checa(
  "…e a ficha ainda é de MENOR (as três réguas não coincidem)",
  varianteDaFicha(NASCIMENTO_16, "2026-09-20") === "MENOR",
);

const NASCIMENTO_13 = "2013-05-03"; // 13 anos em 2026-09-20
checa(
  "aos 13: turma é Jovens/Adultos, escala ainda é Kids…",
  !idadeCombinaComTurma(13, TURMA_KIDS) &&
    escalaPorIdade(13) === "KIDS",
);
checa(
  "…e a ficha é de MENOR",
  varianteDaFicha(NASCIMENTO_13, "2026-09-20") === "MENOR",
);

// A variante aceita Date além de string, porque é assim que o valor chega do
// Prisma. Se as duas formas divergissem, a ficha de um aluno mudaria conforme
// o caminho por onde a data passou — erro silencioso clássico.
checa(
  "Date e string dão a mesma variante",
  varianteDaFicha(diaParaData("2008-09-20"), "2026-09-20") ===
    varianteDaFicha("2008-09-20", "2026-09-20"),
);

checa(
  "cada variante aponta para o seu tipo de documento",
  TIPO_DOCUMENTO_DA_VARIANTE.MENOR === "FICHA_MENOR" &&
    TIPO_DOCUMENTO_DA_VARIANTE.ADULTO === "FICHA_ADULTO",
);

console.log("\nTextos da ficha — o que vai no papel assinado");

// Os termos são o instrumento jurídico. Estas asserções não julgam o texto:
// checam que ele continua inteiro. Um item apagado numa refatoração sairia do
// papel sem ninguém notar, e o papel já estaria assinado.
checa("o termo de menor tem os dez itens", ITENS_TERMO_MENOR.length === 10);
checa(
  "os dez itens estão numerados de 1 a 10, em ordem",
  ITENS_TERMO_MENOR.every((item, i) => item.startsWith(`${i + 1}- `)),
);
checa("a cessão tem os nove parágrafos", PARAGRAFOS_CESSAO.length === 9);
checa("o termo de adulto tem os três parágrafos", PARAGRAFOS_TERMO_ADULTO.length === 3);
checa(
  "nenhum texto da ficha está vazio",
  [
    ...ITENS_TERMO_MENOR,
    ...PARAGRAFOS_CESSAO,
    ...PARAGRAFOS_TERMO_ADULTO,
    INTRODUCAO_TERMO_MENOR,
  ].every((t) => t.trim().length > 30),
);

// A regra das três faltas, que o painel da fase 7 vai usar como default, está
// escrita no termo que a família assina. Se o texto mudar, o default muda
// junto — e é aqui que alguém descobre isso, não depois.
checa(
  "o termo assinado continua falando em 3 faltas consecutivas",
  PARAGRAFOS_CESSAO.some((p) => p.includes("Não faltar mais de 3 vezes consecutivas")),
);

// A ficha leva só a marca do projeto. A Equipe Sul Tucujú não entra: seriam
// duas gerações de documento assinado.
checa(
  "nenhum texto da ficha menciona a segunda marca",
  ![...PARAGRAFOS_CESSAO, ...PARAGRAFOS_TERMO_ADULTO, ...ITENS_TERMO_MENOR]
    .join(" ")
    .includes("Tucujú"),
);

checa("a versão do template está declarada", /^v\d+$/.test(VERSAO_FICHA));

// =====================================================================
console.log("\nMáscara de CPF");

for (const [digitado, esperado] of [
  ["", ""],
  ["1", "1"],
  ["123", "123"],
  ["1234", "123.4"],
  ["123456", "123.456"],
  ["1234567", "123.456.7"],
  ["123456789", "123.456.789"],
  ["1234567890", "123.456.789-0"],
  ["12345678909", "123.456.789-09"],
  // Colar um CPF já formatado não pode duplicar pontuação.
  ["123.456.789-09", "123.456.789-09"],
  // Nem aceitar mais que onze dígitos.
  ["12345678909999", "123.456.789-09"],
  // Letra digitada por engano é descartada, não trava o campo.
  ["123a456", "123.456"],
] as const) {
  checa(`máscara de "${digitado}" é "${esperado}"`, mascaraCpf(digitado) === esperado);
}

// A máscara formata, não valida: quem reprova o dígito verificador é
// ehCpfValido. Sem este par, uma máscara que deixasse passar qualquer coisa
// pareceria correta.
checa("a máscara não valida o dígito verificador", mascaraCpf("111.111.111-11") === "111.111.111-11");
checa("…e o validador reprova o mesmo valor", !ehCpfValido("111.111.111-11"));

// =====================================================================
console.log("\nDesligamento e reativação — o campo que não existe na tela");

// O bug da fase 4: `FormData.get()` devolve `null` para campo ausente no HTML,
// e o motivo só é renderizado no desligamento. Reativar quebrava com
// "expected string, received null" — numa tela sem campo nenhum para corrigir.
const ID = "e466373d-b19e-4939-bab0-a4b4671f0888";

const reativacao = esquemaStatusAluno.safeParse({ id: ID, motivo: null });
checa("reativação passa sem o campo de motivo", reativacao.success);
checa(
  "…e o motivo chega como null",
  reativacao.success && reativacao.data.motivo === null,
);

checa(
  "campo ausente de verdade (undefined) também passa",
  esquemaStatusAluno.safeParse({ id: ID }).success,
);
checa(
  "textarea em branco vira null, não string vazia",
  (() => {
    const r = esquemaStatusAluno.safeParse({ id: ID, motivo: "   " });
    return r.success && r.data.motivo === null;
  })(),
);

// Controle negativo: o esquema não virou um passa-tudo.
const desligamento = esquemaStatusAluno.safeParse({
  id: ID,
  motivo: "Mudou de cidade",
});
checa(
  "desligamento preserva o motivo escrito",
  desligamento.success && desligamento.data.motivo === "Mudou de cidade",
);
checa("id que não é uuid é recusado", !esquemaStatusAluno.safeParse({ id: "1", motivo: null }).success);
checa(
  "motivo acima de 300 caracteres é recusado",
  !esquemaStatusAluno.safeParse({ id: ID, motivo: "x".repeat(301) }).success,
);

console.log("\nCampo opcional inválido diz qual é o erro");

// O campo opcional aceita vazio e, preenchido errado, devolve a mensagem dele
// — não o "Invalid input" genérico que a união com null produzia.
const ALUNO_MINIMO = {
  nome: "Aluno de Teste",
  nascimento: "2015-01-01",
  turmaId: ID,
  modalidade: "JIU_JITSU",
  graduacao: "KIDS_BRANCA",
  grau: "0",
  sexo: "M",
};

function mensagens(extra: Record<string, string>): string[] {
  const r = esquemaAluno.safeParse({ ...ALUNO_MINIMO, ...extra });
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

for (const [campo, invalido, esperado] of [
  ["cpf", "123.456.789-00", "CPF inválido — confira os dígitos."],
  ["cep", "123", "CEP no formato 00000-000."],
  ["telefoneAluno", "1234", "Telefone do aluno: informe com DDD."],
  ["peso", "999", "Peso fora do plausível (10 a 250 kg)."],
  ["estado", "XX", "Estado: use uma UF válida."],
] as const) {
  checa(`${campo} em branco passa`, mensagens({ [campo]: "" }).length === 0);
  checa(`${campo} inválido diz "${esperado}"`, mensagens({ [campo]: invalido }).includes(esperado));
}

// =====================================================================
console.log("\nChamada: faltas consecutivas são sequência, não soma");

const P = (data: string) => ({ data, presente: true });
const F = (data: string) => ({ data, presente: false });

checa("sem registro nenhum, zero", faltasConsecutivas([]) === 0);
checa(
  "falta, vem, falta, falta dá 2 — NÃO é risco com N=3",
  faltasConsecutivas([F("2026-09-01"), P("2026-09-03"), F("2026-09-05"), F("2026-09-08")]) === 2 &&
    !emRiscoDeEvasao(2, 3),
);
checa(
  "três faltas seguidas dá 3 — É risco com N=3",
  faltasConsecutivas([P("2026-09-01"), F("2026-09-03"), F("2026-09-05"), F("2026-09-08")]) === 3 &&
    emRiscoDeEvasao(3, 3),
);
checa(
  "presença no registro mais recente zera, mesmo com faltas antes",
  faltasConsecutivas([F("2026-09-01"), F("2026-09-03"), F("2026-09-05"), P("2026-09-08")]) === 0,
);
checa(
  "ordem de entrada não importa — a função ordena por data",
  faltasConsecutivas([F("2026-09-08"), P("2026-09-01"), F("2026-09-05"), F("2026-09-03")]) === 3,
);
checa("quatro faltas também é risco (limiar é mínimo, não exato)", emRiscoDeEvasao(4, 3));
checa("duas faltas com N=3 não é risco", !emRiscoDeEvasao(2, 3));

console.log("\nChamada: última presença");

checa("sem registro, nenhuma", ultimaPresenca([]) === null);
checa("só faltas, nenhuma", ultimaPresenca([F("2026-09-01"), F("2026-09-03")]) === null);
checa(
  "a presença mais recente, fora de ordem e ignorando faltas posteriores",
  ultimaPresenca([P("2026-09-08"), F("2026-09-15"), P("2026-09-01"), F("2026-09-10")]) ===
    "2026-09-08",
);

console.log("\nChamada: limiar de faltas vindo da configuração");

checa('"3" vira 3', limiarFaltas("3") === 3);
checa('"5" vira 5', limiarFaltas("5") === 5);
checa(
  "linha ausente cai no default 3",
  limiarFaltas(undefined) === FALTAS_ALERTA_PADRAO && FALTAS_ALERTA_PADRAO === 3,
);
checa("lixo cai no default", limiarFaltas("abc") === 3);
checa("zero cai no default (não liga o alerta para todos)", limiarFaltas("0") === 3);
checa("fração cai no default", limiarFaltas("2.5") === 3);

console.log("\nChamada: data — futuro barrado no servidor, retroativo avisa");

const HOJE = "2026-10-03";
const hojeOk = situacaoDoDia(HOJE, HOJE);
checa("hoje passa, sem aviso de retroativo", hojeOk.ok && !hojeOk.retroativo);
const ontem = situacaoDoDia("2026-10-02", HOJE);
checa("ontem passa, com aviso de retroativo", ontem.ok && ontem.retroativo);
checa("amanhã é recusado", !situacaoDoDia("2026-10-04", HOJE).ok);
checa("ano que vem é recusado", !situacaoDoDia("2027-01-01", HOJE).ok);
checa("data inexistente é recusada", !situacaoDoDia("2026-02-30", HOJE).ok);

// O caso clássico: 21h30 em SC já é 00:30 do dia seguinte em UTC.
const noiteLocal = new Date("2026-10-04T00:30:00Z"); // 03/10, 21h30 em SC
checa("às 21h30 locais, o hoje do projeto ainda é 03/10", hojeNoProjeto(noiteLocal) === "2026-10-03");
checa(
  "às 21h30 locais, lançar para 04/10 é futuro e é recusado",
  !situacaoDoDia("2026-10-04", hojeNoProjeto(noiteLocal)).ok,
);
checa(
  "à 00h01 locais, 04/10 já é hoje e passa",
  situacaoDoDia("2026-10-04", hojeNoProjeto(new Date("2026-10-04T03:01:00Z"))).ok,
);
checa(
  "o dia gravado é o dia civil, sem deslize de fuso",
  dataParaDia(diaParaData("2026-10-03")) === "2026-10-03",
);

console.log("\nChamada: payload do fechamento");

const A1 = "e466373d-b19e-4939-bab0-a4b4671f0888";
const A2 = "4b0b2a43-5d0b-4c0e-9a5e-2f1d4f6c7a11";
const TURMA = "0f8e5f3a-2c4d-4e6f-8a9b-1c2d3e4f5a6b";
checa(
  "ausente dentro da lista passa",
  esquemaChamada.safeParse({ turmaId: TURMA, data: HOJE, alunoId: [A1, A2], ausente: [A2] }).success,
);
checa(
  "ausente fora da lista é recusado",
  !esquemaChamada.safeParse({ turmaId: TURMA, data: HOJE, alunoId: [A1], ausente: [A2] }).success,
);
checa(
  "lista vazia é recusada",
  !esquemaChamada.safeParse({ turmaId: TURMA, data: HOJE, alunoId: [], ausente: [] }).success,
);

console.log("\nParâmetros: faixa do N de faltas e da capacidade");

const faltasLidas = (v: string | null) => lerInteiro(esquemaFaltas, v);
checa("N = 1 aceito (limite inferior)", faltasLidas("1").success);
checa("N = 10 aceito (limite superior)", faltasLidas("10").success);
checa("N = 3 vira o número 3", faltasLidas(" 3 ").data === 3);
checa("N = 0 recusado", !faltasLidas("0").success);
checa("N = 11 recusado", !faltasLidas("11").success);
checa("N fracionado recusado", !faltasLidas("2.5").success);
checa("N vazio recusado (não vira 0)", !faltasLidas("").success);
checa("N ausente recusado", !faltasLidas(null).success);

const capKids = (v: string) => lerInteiro(esquemaCapacidade("Kids"), v);
checa("capacidade 40 aceita", capKids("40").data === 40);
checa("capacidade 0 recusada", !capKids("0").success);
checa("capacidade vazia recusada", !capKids("").success);
checa(
  "mensagem de capacidade nomeia a turma",
  capKids("0").error?.issues[0].message.includes("Kids") === true,
);

console.log("\nParâmetros: capacidade abaixo da ocupação avisa, não bloqueia");

checa("35 com 38 ativos avisa", avisoCapacidadeAbaixo("Kids", 35, 38)?.includes("38/35") === true);
checa("38 com 38 ativos não avisa (cheia não é acima)", avisoCapacidadeAbaixo("Kids", 38, 38) === null);
checa("40 com 38 ativos não avisa", avisoCapacidadeAbaixo("Kids", 40, 38) === null);
checa("campo vazio no meio da digitação não avisa", avisoCapacidadeAbaixo("Kids", NaN, 38) === null);

console.log("\nPainel: semana das chamadas, de segunda a domingo");

checa("segunda é a própria segunda", segundaDaSemana("2026-09-28") === "2026-09-28");
checa("quarta volta para a segunda", segundaDaSemana("2026-09-30") === "2026-09-28");
checa("sábado volta para a segunda", segundaDaSemana("2026-10-03") === "2026-09-28");
checa("domingo volta para a segunda ANTERIOR, não avança", segundaDaSemana("2026-10-04") === "2026-09-28");
checa("a segunda seguinte abre outra semana", segundaDaSemana("2026-10-05") === "2026-10-05");
checa("semana que atravessa o ano", segundaDaSemana("2027-01-03") === "2026-12-28");
checa("domingo da semana é segunda + 6", deslocarDia("2026-09-28", 6) === "2026-10-04");
checa("deslocar atravessa o mês", deslocarDia("2026-09-30", 1) === "2026-10-01");
// Domingo 04/10, 22h em SC = segunda 05/10, 01h em UTC. Com o dia do servidor,
// o painel mostraria a semana nova, ainda vazia.
const domingoNoite = new Date("2026-10-05T01:00:00Z");
checa(
  "domingo 22h em SC ainda é a semana que começou na segunda 28/09",
  segundaDaSemana(hojeNoProjeto(domingoNoite)) === "2026-09-28",
);
checa(
  "controle: pelo dia UTC a resposta seria outra (o caso existe)",
  segundaDaSemana(dataParaDia(domingoNoite)) === "2026-10-05",
);

console.log("\nLista de espera: obrigatórios e validações");

const TURMA_ESPERA = "0f8e5f3a-2c4d-4e6f-8a9b-1c2d3e4f5a6b";
const ESPERA_OK = {
  nome: "Maria da Silva",
  nascimento: "2018-03-10",
  telefone: "",
  turmaPretendidaId: TURMA_ESPERA,
  dataEntrada: "2026-08-15",
  observacao: "",
};
const espera = (extra: Record<string, unknown>) =>
  esquemaEspera.safeParse({ ...ESPERA_OK, ...extra });

const esperaMinima = espera({});
checa("nome, nascimento, turma e data bastam", esperaMinima.success);
checa(
  "telefone e observação vazios viram null",
  esperaMinima.success &&
    esperaMinima.data.telefone === null &&
    esperaMinima.data.observacao === null,
);
checa("sem turma pretendida é recusado", !espera({ turmaPretendidaId: "" }).success);
checa("sem nome é recusado", !espera({ nome: " " }).success);
checa("nascimento no futuro é recusado", !espera({ nascimento: "2099-01-01" }).success);
checa("data de entrada no futuro é recusada", !espera({ dataEntrada: "2099-01-01" }).success);
checa("data de entrada antiga é aceita (fila em papel)", espera({ dataEntrada: "2025-02-01" }).success);
checa("telefone sem DDD é recusado", !espera({ telefone: "99123-4567" }).success);
const esperaTel = espera({ telefone: "48991234567" });
checa(
  "telefone com DDD é normalizado",
  esperaTel.success && esperaTel.data.telefone === "(48) 99123-4567",
);

console.log("\nLista de espera: remoção exige motivo");

checa("com motivo passa", esquemaRemocaoEspera.safeParse({ id: TURMA_ESPERA, motivo: "Desistiu" }).success);
checa("motivo vazio é recusado", !esquemaRemocaoEspera.safeParse({ id: TURMA_ESPERA, motivo: "  " }).success);
checa("motivo ausente é recusado", !esquemaRemocaoEspera.safeParse({ id: TURMA_ESPERA, motivo: null }).success);

console.log("\nLista de espera: ordem da fila");

const registro = (turmaNome: string, dataEntrada: string, criado: string) => ({
  turmaNome,
  dataEntrada,
  criadoEm: new Date(criado),
  rotulo: `${turmaNome}/${dataEntrada}/${criado.slice(11, 16)}`,
});
const filaOrdenada = [
  registro("Kids", "2026-09-01", "2026-09-01T12:00:00Z"),
  registro("Jovens/Adultos", "2026-09-10", "2026-09-10T12:00:00Z"),
  registro("Kids", "2026-08-01", "2026-09-20T15:00:00Z"),
  registro("Kids", "2026-08-01", "2026-09-20T14:00:00Z"),
  registro("Jovens/Adultos", "2026-07-01", "2026-07-01T12:00:00Z"),
]
  .sort(ordemDaFila)
  .map((r) => r.rotulo);
checa(
  "por turma, depois data de entrada, depois quem foi digitado antes",
  filaOrdenada.join(" | ") ===
    [
      "Jovens/Adultos/2026-07-01/12:00",
      "Jovens/Adultos/2026-09-10/12:00",
      "Kids/2026-08-01/14:00",
      "Kids/2026-08-01/15:00",
      "Kids/2026-09-01/12:00",
    ].join(" | "),
);
checa(
  "data de entrada manda mais que a data de digitação",
  filaOrdenada.indexOf("Kids/2026-08-01/15:00") < filaOrdenada.indexOf("Kids/2026-09-01/12:00"),
);

// =====================================================================
console.log("\nInventário: saldo derivado dos movimentos");

// Kimono: 3 entradas, nenhuma saída, 1 emprestado. O total não cai com o
// empréstimo — emprestar não é saída.
const kimono = contagem(3, 0, 1);
checa("emprestar não mexe no total", kimono.total === 3);
checa("disponível = total − emprestados", kimono.disponivel === 2);
// Perdido: a SAIDA tira 1 do total e o status deixa de ser EMPRESTADO. As duas
// pontas fecham: o disponível continua 2, não cai duas vezes.
const kimonoPerdido = contagem(3, 1, 0);
checa("perdido gera SAIDA e o disponível não desconta duas vezes", kimonoPerdido.total === 2 && kimonoPerdido.disponivel === 2);
// Controle negativo: se o empréstimo também gerasse SAIDA, a mesma unidade
// sairia duas vezes do disponível.
checa("controle: empréstimo com SAIDA descontaria duas vezes", contagem(3, 1, 1).disponivel === 1);

const contagensLista = contagensPorItem(
  [
    { itemId: "a", tipo: "ENTRADA", quantidade: 30 },
    { itemId: "a", tipo: "SAIDA", quantidade: 4 },
    { itemId: "b", tipo: "ENTRADA", quantidade: 1 },
  ],
  [{ itemId: "b", quantidade: 1 }],
);
checa("lista: entradas menos saídas por item", contagensLista.get("a")?.total === 26);
checa("lista: item sem empréstimo tem tudo disponível", contagensLista.get("a")?.disponivel === 26);
checa("lista: unidade única emprestada fica com 0 disponível", contagensLista.get("b")?.disponivel === 0 && contagensLista.get("b")?.total === 1);

console.log("\nInventário: abaixo do mínimo compara o total");

checa("total abaixo do mínimo avisa", abaixoDoMinimo(4, 5));
checa("total igual ao mínimo não avisa", !abaixoDoMinimo(5, 5));
checa("mínimo 0 é sem mínimo", !abaixoDoMinimo(0, 0));

console.log("\nInventário: empréstimo em aberto trava desativação e emprestável");

const barradoInventario = decidirComEmprestimoAberto("desativar", 1, false);
checa("INVENTARIO com empréstimo aberto é barrado", barradoInventario !== null && "erro" in barradoInventario);
const avisoAdmin = decidirComEmprestimoAberto("desativar", 1, true);
checa("ADMIN com empréstimo aberto passa com aviso", avisoAdmin !== null && "aviso" in avisoAdmin);
checa("sem empréstimo aberto ninguém é barrado", decidirComEmprestimoAberto("desmarcarEmprestavel", 0, false) === null);
const desmarcar = decidirComEmprestimoAberto("desmarcarEmprestavel", 2, false);
checa("desmarcar emprestável também barra INVENTARIO", desmarcar !== null && "erro" in desmarcar);

console.log("\nInventário: cadastro do item");

const itemBase = {
  descricao: "Faixa branca A2",
  categoria: "",
  observacao: "",
  unidadeMedida: "un",
  quantidadeMinima: "10",
  identificacao: "",
  estadoConservacao: "NOVO",
  podeSerEmprestado: null,
};
const itemOk = esquemaItemNovo.safeParse({ ...itemBase, quantidade: "30" });
checa("item válido passa", itemOk.success);
checa("checkbox ausente vira não emprestável", itemOk.success && itemOk.data.podeSerEmprestado === false);
checa("checkbox marcado vira emprestável", esquemaItemNovo.safeParse({ ...itemBase, quantidade: "1", podeSerEmprestado: "on" }).data?.podeSerEmprestado === true);
checa("categoria vazia vira null", itemOk.success && itemOk.data.categoria === null);
checa("quantidade 0 no cadastro é recusada", !esquemaItemNovo.safeParse({ ...itemBase, quantidade: "0" }).success);
checa("quantidade vazia é recusada (não vira 0)", !esquemaItemNovo.safeParse({ ...itemBase, quantidade: "" }).success);
checa("quantidade negativa é recusada", !esquemaItemNovo.safeParse({ ...itemBase, quantidade: "-3" }).success);
checa("quantidade fracionária é recusada", !esquemaItemNovo.safeParse({ ...itemBase, quantidade: "1.5" }).success);
checa("mínimo vazio é recusado", !esquemaItem.safeParse({ ...itemBase, quantidadeMinima: "" }).success);
checa("descrição vazia é recusada", !esquemaItem.safeParse({ ...itemBase, descricao: "  " }).success);
// A edição não carrega quantidade: o esquema de edição a ignora.
checa("edição não aceita quantidade como campo", !("quantidade" in (esquemaItem.safeParse({ ...itemBase, quantidade: "99" }).data ?? {})));

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} falha(s). As regras de domínio divergiram do CLAUDE.md.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
