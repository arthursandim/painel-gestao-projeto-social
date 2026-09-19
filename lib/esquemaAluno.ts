// O contrato do cadastro de aluno.
//
// Obrigatórios: nome, nascimento, turma, modalidade, graduação e sexo. Todo o
// resto é opcional de propósito — em projeto social boa parte das crianças
// chega sem documento em mãos, e formulário rígido produz cadastro não feito ou
// dado inventado. Quem cobra o que falta é o indicador de completude, não o
// botão de salvar.
import { Graduacao, Modalidade, ResponsavelTipo, Sexo } from "@prisma/client";
import { z } from "zod";

import { diaEhFuturo, ehDiaValido, hojeNoProjeto, idadeEm } from "@/lib/data";
import {
  GRAU_MAXIMO,
  GRAU_MINIMO,
  escalaDaGraduacao,
  escalaDoAluno,
  ROTULO_ESCALA,
} from "@/lib/graduacao";
import {
  ehCepValido,
  ehCpfValido,
  ehTelefoneValido,
  ehUf,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  UFS,
} from "@/lib/validacoes";

/** Idade máxima aceita. Acima disso é erro de digitação no ano, não um aluno. */
export const IDADE_MAXIMA_PLAUSIVEL = 100;

const vazio = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Campo opcional vindo de formulário.
 *
 * Campo em branco chega como `""`, não como ausente, e `""` precisa virar
 * `null` antes de qualquer validação — senão o validador de CPF reprova o campo
 * vazio e o formulário passa a exigir o documento que o documento manda não
 * exigir.
 */
function opcional<S extends z.ZodType>(esquema: S) {
  return z.preprocess((v) => (vazio(v) ? null : v), z.union([z.null(), esquema]));
}

const texto = (max: number) => opcional(z.string().trim().min(1).max(max));

const dia = (rotulo: string) =>
  z
    .string()
    .trim()
    .refine(ehDiaValido, { error: `${rotulo}: data inválida.` });

const diaOpcionalNaoFuturo = (rotulo: string) =>
  opcional(
    dia(rotulo).refine((v) => !diaEhFuturo(v), {
      error: `${rotulo} não pode estar no futuro.`,
    }),
  );

const decimal = (min: number, max: number, erro: string) =>
  opcional(
    z
      .string()
      .trim()
      .refine(
        (v) => {
          const n = Number(v.replace(",", "."));
          return Number.isFinite(n) && n >= min && n <= max;
        },
        { error: erro },
      )
      .transform((v) => Number(v.replace(",", "."))),
  );

const uf = (rotulo: string) =>
  opcional(
    z
      .string()
      .trim()
      .toUpperCase()
      .refine(ehUf, { error: `${rotulo}: use uma UF válida.` })
      .transform((v) => v.toUpperCase()),
  );

export const esquemaAluno = z
  .object({
    // ---------------------------------------------------------- obrigatórios
    nome: z
      .string()
      .trim()
      .min(3, { error: "Informe o nome completo do aluno." })
      .max(150),

    nascimento: dia("Nascimento")
      .refine((v) => !diaEhFuturo(v), {
        error: "A data de nascimento não pode estar no futuro.",
      })
      .refine((v) => idadeEm(v, hojeNoProjeto()) <= IDADE_MAXIMA_PLAUSIVEL, {
        error: "Idade implausível — confira o ano de nascimento.",
      }),

    turmaId: z.uuid({ error: "Escolha a turma." }),
    modalidade: z.enum(Modalidade, { error: "Escolha a modalidade." }),
    graduacao: z.enum(Graduacao, { error: "Escolha a graduação." }),
    grau: z.coerce
      .number()
      .int()
      .min(GRAU_MINIMO, { error: `O grau vai de ${GRAU_MINIMO} a ${GRAU_MAXIMO}.` })
      .max(GRAU_MAXIMO, { error: `O grau vai de ${GRAU_MINIMO} a ${GRAU_MAXIMO}.` }),
    sexo: z.enum(Sexo, { error: "Escolha o sexo." }),

    // -------------------------------------------------------------- opcionais
    graduacaoData: diaOpcionalNaoFuturo("Data da graduação"),

    naturalidade: texto(120),
    nomePai: texto(150),
    nomeMae: texto(150),

    responsavelTipo: opcional(z.enum(ResponsavelTipo)),
    responsavelNome: texto(150),
    responsavelParentesco: texto(60),

    endereco: texto(200),
    numero: texto(20),
    bairro: texto(120),
    cidade: texto(120),
    estado: uf("Estado"),
    cep: opcional(
      z
        .string()
        .trim()
        .refine(ehCepValido, { error: "CEP no formato 00000-000." })
        .transform(formatarCep),
    ),

    // Normalizado na gravação: todo telefone fica no banco como (96) 99123-4567.
    // Sem isto conviveriam "96991234567", "96 99123-4567" e "(96)99123-4567", e
    // a mesma pessoa pareceria três contatos diferentes numa busca futura.
    telefoneResponsavel: opcional(
      z
        .string()
        .trim()
        .refine(ehTelefoneValido, {
          error: "Telefone do responsável: informe com DDD.",
        })
        .transform(formatarTelefone),
    ),
    telefoneAluno: opcional(
      z
        .string()
        .trim()
        .refine(ehTelefoneValido, {
          error: "Telefone do aluno: informe com DDD.",
        })
        .transform(formatarTelefone),
    ),
    email: opcional(z.email({ error: "E-mail inválido." })),

    rg: texto(30),
    rgOrgaoEmissor: texto(30),
    rgUf: uf("UF do RG"),
    rgDataEmissao: diaOpcionalNaoFuturo("Data de emissão do RG"),
    cpf: opcional(
      z
        .string()
        .trim()
        .refine(ehCpfValido, { error: "CPF inválido — confira os dígitos." })
        .transform(formatarCpf),
    ),

    escola: texto(150),
    serie: texto(60),

    peso: decimal(10, 250, "Peso fora do plausível (10 a 250 kg)."),
    altura: decimal(0.5, 2.5, "Altura em metros, entre 0,50 e 2,50."),
  })
  .superRefine((dados, ctx) => {
    // Responsável legal é referência, não cópia. Em PAI e MAE o nome sai de
    // nomePai/nomeMae na leitura, e gravar uma cópia aqui faria a correção do
    // nome da mãe deixar o responsável com o nome antigo — em silêncio.
    if (dados.responsavelTipo === ResponsavelTipo.PAI && !dados.nomePai) {
      ctx.addIssue({
        code: "custom",
        path: ["nomePai"],
        message: "Para marcar o pai como responsável, preencha o nome do pai.",
      });
    }
    if (dados.responsavelTipo === ResponsavelTipo.MAE && !dados.nomeMae) {
      ctx.addIssue({
        code: "custom",
        path: ["nomeMae"],
        message: "Para marcar a mãe como responsável, preencha o nome da mãe.",
      });
    }
    if (dados.responsavelTipo === ResponsavelTipo.OUTRO) {
      if (!dados.responsavelNome) {
        ctx.addIssue({
          code: "custom",
          path: ["responsavelNome"],
          message: "Informe o nome do responsável legal.",
        });
      }
      if (!dados.responsavelParentesco) {
        ctx.addIssue({
          code: "custom",
          path: ["responsavelParentesco"],
          message: "Informe o parentesco (avó, tio, guardião…).",
        });
      }
    }

    if (
      dados.graduacaoData &&
      dados.graduacaoData < dados.nascimento
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["graduacaoData"],
        message: "A graduação não pode ser anterior ao nascimento.",
      });
    }
  })
  .transform((dados) => ({
    ...dados,
    // Em PAI e MAE não existe nome nem parentesco guardados: a leitura deriva
    // os dois. Zerar aqui impede que um valor deixado no formulário de uma
    // escolha anterior sobreviva no banco como dado morto e contraditório.
    responsavelNome:
      dados.responsavelTipo === ResponsavelTipo.OUTRO
        ? dados.responsavelNome
        : null,
    responsavelParentesco:
      dados.responsavelTipo === ResponsavelTipo.OUTRO
        ? dados.responsavelParentesco
        : null,
  }));

export type DadosAluno = z.output<typeof esquemaAluno>;

/** Os nomes de campo que o formulário envia, na ordem em que aparecem na tela. */
export const CAMPOS_ALUNO = [
  "nome",
  "nascimento",
  "turmaId",
  "modalidade",
  "graduacao",
  "grau",
  "sexo",
  "graduacaoData",
  "naturalidade",
  "nomePai",
  "nomeMae",
  "responsavelTipo",
  "responsavelNome",
  "responsavelParentesco",
  "endereco",
  "numero",
  "bairro",
  "cidade",
  "estado",
  "cep",
  "telefoneResponsavel",
  "telefoneAluno",
  "email",
  "rg",
  "rgOrgaoEmissor",
  "rgUf",
  "rgDataEmissao",
  "cpf",
  "escola",
  "serie",
  "peso",
  "altura",
] as const;

export function camposDoForm(dados: FormData): Record<string, unknown> {
  return Object.fromEntries(CAMPOS_ALUNO.map((c) => [c, dados.get(c)]));
}

/**
 * A faixa escolhida serve para esta data de nascimento?
 *
 * Fora do esquema de propósito, porque a resposta depende de uma terceira
 * coisa que o esquema não conhece: a faixa que já estava gravada. Um aluno que
 * fez 16 anos com faixa kids continua gravado assim até alguém reposicioná-lo,
 * e uma edição de telefone não pode ser barrada por causa disso — o CLAUDE.md
 * manda o sistema sinalizar, não agir. Ver `conferirEscala`.
 */
export function conferirEscala(
  graduacao: Graduacao,
  nascimento: string,
  graduacaoAnterior?: Graduacao | null,
): string | null {
  const escalaDoValor = escalaDaGraduacao(graduacao);
  const escalaDaIdade = escalaDoAluno(nascimento);
  if (escalaDoValor === escalaDaIdade) return null;

  // Faixa inalterada: é o aluno que atravessou o corte, não uma escolha errada
  // de quem está editando. Passa, e o aviso permanente cuida do resto.
  if (graduacaoAnterior && graduacao === graduacaoAnterior) return null;

  return `Esta data de nascimento usa a escala ${ROTULO_ESCALA[escalaDaIdade]}, e a faixa escolhida é da escala ${ROTULO_ESCALA[escalaDoValor]}. Escolha a faixa de novo.`;
}

export const OPCOES_UF = UFS;
