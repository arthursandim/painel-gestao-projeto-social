// Visibilidade por campo do aluno.
//
// A mesma tela mostra menos dados dependendo do papel, e esconder no React não
// é permissão: quem tem que devolver menos é a API. Este arquivo é o seletor
// único que o documento pede — nenhuma consulta a Aluno deve montar `select` à
// mão, todas passam por `selectAlunoPara`.
import { Papel, type Prisma } from "@prisma/client";

/**
 * Lista branca, nunca lista negra.
 *
 * A diferença importa no dia em que alguém acrescentar uma coluna ao Aluno: com
 * lista branca a coluna nova simplesmente não aparece para o professor até
 * alguém decidir que deve aparecer. Com lista negra, ela vazaria em silêncio —
 * que é exatamente o modo de falhar que o documento manda evitar.
 */
const SELECAO_REDUZIDA = {
  id: true,
  matricula: true,
  nome: true,
  nascimento: true,
  sexo: true,
  modalidade: true,
  graduacao: true,
  grau: true,
  graduacaoData: true,
  peso: true,
  altura: true,
  nomePai: true,
  nomeMae: true,
  fotoPath: true,
  status: true,
  turmaId: true,
  turma: { select: { id: true, codigo: true, nome: true } },
} as const satisfies Prisma.AlunoSelect;

const SELECAO_COMPLETA = {
  ...SELECAO_REDUZIDA,

  naturalidade: true,

  responsavelTipo: true,
  responsavelNome: true,
  responsavelParentesco: true,

  endereco: true,
  numero: true,
  bairro: true,
  cidade: true,
  estado: true,
  cep: true,

  telefoneResponsavel: true,
  telefoneAluno: true,
  email: true,

  rg: true,
  rgOrgaoEmissor: true,
  rgUf: true,
  rgDataEmissao: true,
  cpf: true,

  escola: true,
  serie: true,

  desligadoEm: true,
  desligadoMotivo: true,
  desligadoPorId: true,
  desligadoPor: { select: { nome: true } },

  acimaCapacidade: true,
  autorizacaoAcimaPorId: true,
  autorizacaoAcimaEm: true,
  autorizacaoAcimaJustificativa: true,
  autorizacaoAcimaPor: { select: { nome: true } },

  // Toda escrita relevante guarda autor e timestamp, e a ficha mostra os dois:
  // trilha que ninguém consegue ler não serve de trilha.
  criadoPorId: true,
  atualizadoPorId: true,
  criadoPor: { select: { nome: true } },
  atualizadoPor: { select: { nome: true } },
  criadoEm: true,
  atualizadoEm: true,
} as const satisfies Prisma.AlunoSelect;

/**
 * Campos que não podem sair numa resposta para quem só é professor.
 *
 * Existe para ser conferido por teste, e não só lido: é a lista das quatro
 * linhas "Não" da tabela do CLAUDE.md, escrita em nomes de coluna.
 *
 * O bloco final não está naquela tabela. São campos que ela não menciona, e a
 * decisão — confirmada com o desenvolvedor na fase 3 — foi default-deny: campo
 * que ninguém autorizou não aparece. `responsavelNome` e `responsavelParentesco`
 * só existem quando o responsável é um terceiro (avó, tio, guardião), e o nome
 * de um terceiro não tem por que circular na visão reduzida; nome do pai e nome
 * da mãe continuam visíveis porque a tabela os autoriza explicitamente.
 */
export const CAMPOS_VEDADOS_AO_PROFESSOR = [
  "telefoneResponsavel",
  "telefoneAluno",
  "email",
  "endereco",
  "numero",
  "bairro",
  "cidade",
  "estado",
  "cep",
  "rg",
  "rgOrgaoEmissor",
  "rgUf",
  "rgDataEmissao",
  "cpf",
  "escola",
  "serie",
  "documentos",

  "naturalidade",
  "responsavelTipo",
  "responsavelNome",
  "responsavelParentesco",
] as const;

export type AlunoReduzido = Prisma.AlunoGetPayload<{
  select: typeof SELECAO_REDUZIDA;
}>;
export type AlunoCompleto = Prisma.AlunoGetPayload<{
  select: typeof SELECAO_COMPLETA;
}>;

/**
 * Decide os campos de Aluno que a consulta devolve.
 *
 * Recebe a lista de papéis, não um papel: o documento define que um usuário
 * acumula papéis. A regra é a união — quem é PROFESSOR e INSCRICOES ao mesmo
 * tempo está na coluna "Inscrições / Admin" da tabela, porque de fato é do
 * setor de inscrições. Papel nenhum cai na visão reduzida, por default-deny.
 */
export function selectAlunoPara(
  papeis: readonly Papel[],
): typeof SELECAO_COMPLETA | typeof SELECAO_REDUZIDA {
  return podeVerDadosSensiveis(papeis) ? SELECAO_COMPLETA : SELECAO_REDUZIDA;
}

/** ADMIN e INSCRICOES enxergam a ficha inteira. PROFESSOR, não. */
export function podeVerDadosSensiveis(papeis: readonly Papel[]): boolean {
  return papeis.includes(Papel.ADMIN) || papeis.includes(Papel.INSCRICOES);
}

/**
 * Estreita o tipo do registro devolvido por uma consulta que usou
 * `selectAlunoPara` com os mesmos papéis.
 *
 * A consulta devolve a união dos dois formatos, e a tela precisa saber qual
 * recebeu. Um `as AlunoCompleto` resolveria e mentiria: valeria mesmo se a
 * consulta tivesse usado outros papéis. Amarrando a guarda ao mesmo predicado
 * que escolheu a seleção, as duas decisões não têm como divergir.
 */
export function ehAlunoCompleto(
  aluno: AlunoReduzido | AlunoCompleto,
  papeis: readonly Papel[],
): aluno is AlunoCompleto {
  return podeVerDadosSensiveis(papeis);
}

/**
 * Documentos digitalizados seguem a mesma divisão. Fica em função própria
 * porque a lista de documentos é relação, não campo, e quem consultar
 * Documento precisa desta checagem antes de montar a query.
 */
export function podeVerDocumentos(papeis: readonly Papel[]): boolean {
  return podeVerDadosSensiveis(papeis);
}
