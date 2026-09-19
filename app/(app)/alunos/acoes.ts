"use server";

import { Papel, StatusAluno } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPapeis } from "@/lib/auth";
import { IDADE_MAIORIDADE } from "@/lib/avisosAluno";
import { diaParaData, hojeNoProjeto, idadeEm } from "@/lib/data";
import {
  camposDoForm,
  conferirEscala,
  esquemaAluno,
  type DadosAluno,
} from "@/lib/esquemaAluno";
import { campoDuplicado, proximaMatricula } from "@/lib/matricula";
import { ehAdmin, PAPEIS_ESCRITA_ALUNO } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { chaveDeNome } from "@/lib/validacoes";

export type EstadoAluno = {
  erro?: string;
  ok?: string;
  /** Aviso de possível duplicidade. Não impede — pede uma confirmação. */
  duplicidade?: { mensagem: string; nome: string };
  /** Turma cheia e quem está salvando é admin: falta a justificativa. */
  exigeAutorizacao?: string;
};

function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

/**
 * Dia civil vira Date de meia-noite UTC só aqui, na fronteira com o Prisma.
 *
 * O aluno maior de idade não tem os campos de responsável legal no formulário,
 * e por isso eles saem do payload em vez de irem como nulos: **omitir preserva,
 * mandar vazio apagaria**. A diferença aparece no aluno que foi menor e virou
 * adulto — a referência que valeu naquele tempo continua gravada, e corrigir o
 * telefone dele não a destrói de passagem.
 */
function paraBanco(dados: DadosAluno, maiorDeIdade: boolean) {
  const { nascimento, graduacaoData, rgDataEmissao, ...resto } = dados;

  const datas = {
    nascimento: diaParaData(nascimento),
    graduacaoData: graduacaoData ? diaParaData(graduacaoData) : null,
    rgDataEmissao: rgDataEmissao ? diaParaData(rgDataEmissao) : null,
  };

  if (!maiorDeIdade) return { ...resto, ...datas };

  return {
    ...resto,
    ...datas,
    // `undefined` é o que o Prisma ignora: a coluna fica fora do UPDATE e
    // mantém o valor que tem. `null` entraria no UPDATE e apagaria.
    responsavelTipo: undefined,
    responsavelNome: undefined,
    responsavelParentesco: undefined,
  };
}

/** O corte dos 18, que decide a forma do formulário e o que a ação grava. */
function ehMaiorDeIdade(nascimentoIso: string): boolean {
  return idadeEm(nascimentoIso, hojeNoProjeto()) >= IDADE_MAIORIDADE;
}

/**
 * Procura um aluno de nome equivalente.
 *
 * Compara chaves normalizadas em memória em vez de um LIKE no banco: são 80
 * alunos, e o banco compararia acento com acento — "José" e "Jose" passariam
 * como nomes diferentes, que é exatamente o par que o aviso existe para pegar.
 */
async function nomeJaExiste(nome: string, ignorarId?: string) {
  const chave = chaveDeNome(nome);
  const todos = await prisma.aluno.findMany({
    select: { id: true, nome: true, matricula: true },
  });
  return (
    todos.find((a) => a.id !== ignorarId && chaveDeNome(a.nome) === chave) ?? null
  );
}

type Ocupacao = {
  turma: { id: string; nome: string; capacidade: number };
  ocupacao: number;
  lotada: boolean;
};

/**
 * Quanta gente ativa a turma tem, contra a capacidade configurada.
 *
 * A contagem e a gravação não são atômicas, e isso é aceitável: o pior caso é
 * duas matrículas simultâneas empurrarem a turma para 41/40 — que é justamente
 * o que o painel mostra e o que o CLAUDE.md chama de exceção visível. O que não
 * pode acontecer é a exceção ficar invisível, e isso o registro da autorização
 * resolve.
 */
async function medirOcupacao(
  turmaId: string,
  ignorarAlunoId?: string,
): Promise<Ocupacao | null> {
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: { id: true, nome: true, capacidade: true },
  });
  if (!turma) return null;

  const ocupacao = await prisma.aluno.count({
    where: {
      turmaId,
      status: StatusAluno.ATIVO,
      ...(ignorarAlunoId ? { id: { not: ignorarAlunoId } } : {}),
    },
  });

  return { turma, ocupacao, lotada: ocupacao >= turma.capacidade };
}

type Autorizacao = {
  acimaCapacidade: boolean;
  autorizacaoAcimaPorId: string | null;
  autorizacaoAcimaEm: Date | null;
  autorizacaoAcimaJustificativa: string | null;
};

const SEM_AUTORIZACAO: Autorizacao = {
  acimaCapacidade: false,
  autorizacaoAcimaPorId: null,
  autorizacaoAcimaEm: null,
  autorizacaoAcimaJustificativa: null,
};

/**
 * A regra da turma cheia: a matrícula não é bloqueada, mas exige autorização
 * explícita de um admin, com justificativa gravada. INSCRICOES sozinho não
 * consegue estourar a turma.
 */
function resolverCapacidade(
  medida: Ocupacao,
  papeis: readonly Papel[],
  autorId: string,
  form: FormData,
): { autorizacao: Autorizacao } | EstadoAluno {
  if (!medida.lotada) return { autorizacao: SEM_AUTORIZACAO };

  const cheia = `A turma ${medida.turma.nome} está com ${medida.ocupacao} de ${medida.turma.capacidade} vagas ocupadas.`;

  if (!ehAdmin(papeis)) {
    return {
      erro: `${cheia} Só um administrador pode autorizar matrícula acima da capacidade — peça a autorização ou escolha outra turma.`,
    };
  }

  const justificativa = String(form.get("justificativaCapacidade") ?? "").trim();
  if (!justificativa) {
    return {
      exigeAutorizacao: `${cheia} Como administrador você pode autorizar assim mesmo, mas a justificativa fica gravada no cadastro.`,
    };
  }

  return {
    autorizacao: {
      acimaCapacidade: true,
      autorizacaoAcimaPorId: autorId,
      autorizacaoAcimaEm: new Date(),
      autorizacaoAcimaJustificativa: justificativa,
    },
  };
}

/**
 * O aviso de possível duplicidade, que avisa e não impede.
 *
 * A confirmação carrega o nome conferido, não um sim genérico: sem isso,
 * confirmar uma vez deixaria o formulário permanentemente surdo, e um segundo
 * nome repetido — digitado depois, no mesmo formulário — passaria calado.
 */
async function conferirDuplicidade(
  nome: string,
  form: FormData,
  ignorarId?: string,
): Promise<EstadoAluno | null> {
  const confirmadoPara = String(form.get("duplicidadeConfirmadaPara") ?? "");
  if (confirmadoPara && chaveDeNome(confirmadoPara) === chaveDeNome(nome)) {
    return null;
  }

  const igual = await nomeJaExiste(nome, ignorarId);
  if (!igual) return null;

  return {
    duplicidade: {
      nome,
      mensagem: `Já existe ${igual.nome} (${igual.matricula}) com este nome. Pode ser a mesma pessoa cadastrada duas vezes — confira antes de continuar.`,
    },
  };
}

// ------------------------------------------------------------------ criar

export async function criarAluno(
  _estado: EstadoAluno,
  form: FormData,
): Promise<EstadoAluno> {
  const autor = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);

  const analise = esquemaAluno.safeParse(camposDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const dados = analise.data;

  // A lista suspensa oferece uma escala só, mas esconder no React não é
  // validação: quem recusa a faixa da escala errada é o servidor.
  const erroEscala = conferirEscala(dados.graduacao, dados.nascimento);
  if (erroEscala) return { erro: erroEscala };

  const duplicidade = await conferirDuplicidade(dados.nome, form);
  if (duplicidade) return duplicidade;

  const medida = await medirOcupacao(dados.turmaId);
  if (!medida) return { erro: "Turma não encontrada." };

  const capacidade = resolverCapacidade(medida, autor.papeis, autor.id, form);
  if (!("autorizacao" in capacidade)) return capacidade;

  let criado: { id: string; matricula: string } | null = null;

  for (let tentativa = 0; tentativa < 10 && !criado; tentativa++) {
    const matricula = await proximaMatricula(prisma);
    try {
      criado = await prisma.aluno.create({
        data: {
          ...paraBanco(dados, ehMaiorDeIdade(dados.nascimento)),
          ...capacidade.autorizacao,
          matricula,
          criadoPorId: autor.id,
          atualizadoPorId: autor.id,
        },
        select: { id: true, matricula: true },
      });
    } catch (erro) {
      const campo = campoDuplicado(erro);
      // Matrícula ocupada só acontece se alguém gravou o número fora da
      // sequence — na importação dos cadastros de papel, por exemplo. Pega o
      // próximo e segue.
      if (campo === "matricula") continue;
      if (campo === "cpf") {
        return { erro: "Este CPF já está cadastrado em outro aluno." };
      }
      throw erro;
    }
  }

  if (!criado) {
    return {
      erro: "Não foi possível gerar uma matrícula livre. Avise o administrador.",
    };
  }

  revalidatePath("/alunos");
  redirect(`/alunos/${criado.id}?novo=${criado.matricula}`);
}

// --------------------------------------------------------------- atualizar

export async function atualizarAluno(
  _estado: EstadoAluno,
  form: FormData,
): Promise<EstadoAluno> {
  const autor = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);

  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Aluno inválido." };

  const atual = await prisma.aluno.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      graduacao: true,
      turmaId: true,
      status: true,
      acimaCapacidade: true,
      autorizacaoAcimaPorId: true,
      autorizacaoAcimaEm: true,
      autorizacaoAcimaJustificativa: true,
    },
  });
  if (!atual) return { erro: "Aluno não encontrado." };

  const analise = esquemaAluno.safeParse(camposDoForm(form));
  if (!analise.success) return { erro: primeiroErro(analise.error) };
  const dados = analise.data;

  // A faixa que já estava gravada continua válida mesmo depois de o aluno
  // atravessar os 16 anos. Recusá-la faria uma correção de telefone exigir que
  // alguém graduasse o aluno de improviso — o app sinaliza, não age.
  const erroEscala = conferirEscala(
    dados.graduacao,
    dados.nascimento,
    atual.graduacao,
  );
  if (erroEscala) return { erro: erroEscala };

  const duplicidade = await conferirDuplicidade(dados.nome, form, atual.id);
  if (duplicidade) return duplicidade;

  // A capacidade só é reavaliada quando o aluno muda de turma. Editar o
  // telefone de quem já está numa turma cheia não pode pedir autorização de
  // novo — a autorização já foi dada e está gravada.
  let autorizacao: Autorizacao = {
    acimaCapacidade: atual.acimaCapacidade,
    autorizacaoAcimaPorId: atual.autorizacaoAcimaPorId,
    autorizacaoAcimaEm: atual.autorizacaoAcimaEm,
    autorizacaoAcimaJustificativa: atual.autorizacaoAcimaJustificativa,
  };

  if (dados.turmaId !== atual.turmaId) {
    const medida = await medirOcupacao(dados.turmaId, atual.id);
    if (!medida) return { erro: "Turma não encontrada." };

    // Aluno desligado não ocupa vaga, então mudá-lo de turma não estoura nada.
    if (atual.status === StatusAluno.ATIVO) {
      const capacidade = resolverCapacidade(medida, autor.papeis, autor.id, form);
      if (!("autorizacao" in capacidade)) return capacidade;
      autorizacao = capacidade.autorizacao;
    } else {
      autorizacao = SEM_AUTORIZACAO;
    }
  }

  try {
    await prisma.aluno.update({
      where: { id: atual.id },
      data: {
        ...paraBanco(dados, ehMaiorDeIdade(dados.nascimento)),
        ...autorizacao,
        atualizadoPorId: autor.id,
      },
    });
  } catch (erro) {
    if (campoDuplicado(erro) === "cpf") {
      return { erro: "Este CPF já está cadastrado em outro aluno." };
    }
    throw erro;
  }

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${atual.id}`);
  redirect(`/alunos/${atual.id}?salvo=1`);
}

// ------------------------------------------------------------ desligamento

const esquemaStatus = z.object({
  id: z.uuid(),
  motivo: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

/**
 * Desliga ou reativa. Nada é apagado: é o status que muda, e a linha continua
 * com tudo que o aluno lançou.
 *
 * Desligar é o que libera a vaga — o ciclo que o app inteiro existe para
 * sustentar. Por isso reativar passa pela mesma regra de capacidade da
 * matrícula: sem isso, desligar e reativar seria o caminho para encher a turma
 * sem autorização de ninguém.
 */
export async function alternarStatusAluno(
  _estado: EstadoAluno,
  form: FormData,
): Promise<EstadoAluno> {
  const autor = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);

  const analise = esquemaStatus.safeParse({
    id: form.get("id"),
    motivo: form.get("motivo"),
  });
  if (!analise.success) return { erro: primeiroErro(analise.error) };

  const aluno = await prisma.aluno.findUnique({
    where: { id: analise.data.id },
    select: { id: true, nome: true, status: true, turmaId: true },
  });
  if (!aluno) return { erro: "Aluno não encontrado." };

  if (aluno.status === StatusAluno.ATIVO) {
    if (!analise.data.motivo) {
      return { erro: "Escreva o motivo do desligamento antes de confirmar." };
    }
    await prisma.aluno.update({
      where: { id: aluno.id },
      data: {
        status: StatusAluno.DESLIGADO,
        desligadoEm: new Date(),
        desligadoMotivo: analise.data.motivo,
        desligadoPorId: autor.id,
        atualizadoPorId: autor.id,
      },
    });

    revalidatePath("/alunos");
    revalidatePath(`/alunos/${aluno.id}`);
    return { ok: `${aluno.nome} foi desligado. A vaga na turma está livre.` };
  }

  const medida = await medirOcupacao(aluno.turmaId, aluno.id);
  if (!medida) return { erro: "Turma não encontrada." };

  const capacidade = resolverCapacidade(medida, autor.papeis, autor.id, form);
  if (!("autorizacao" in capacidade)) return capacidade;

  // O motivo do desligamento anterior é limpo junto com o status. A v1 não
  // guarda histórico de desligamentos — se a diretoria precisar dele, o certo
  // é uma tabela própria, não deixar dois campos se contradizendo nesta linha.
  await prisma.aluno.update({
    where: { id: aluno.id },
    data: {
      status: StatusAluno.ATIVO,
      desligadoEm: null,
      desligadoMotivo: null,
      desligadoPorId: null,
      ...capacidade.autorizacao,
      atualizadoPorId: autor.id,
    },
  });

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${aluno.id}`);
  return { ok: `${aluno.nome} voltou para a turma.` };
}
