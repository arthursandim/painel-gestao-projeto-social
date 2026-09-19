import { StatusAluno } from "@prisma/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarAluno } from "../../acoes";
import {
  FormularioAluno,
  VALORES_VAZIOS,
  type ValoresAluno,
} from "../../formulario-aluno";
import { BotaoVoltar } from "@/components/botao-voltar";
import { exigirPapeis } from "@/lib/auth";
import { dataParaDia, hojeNoProjeto } from "@/lib/data";
import { ehAdmin, PAPEIS_ESCRITA_ALUNO } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { ehAlunoCompleto, selectAlunoPara } from "@/lib/selecaoAluno";

export const metadata: Metadata = { title: "Editar aluno — Engenho Cidadão" };

/** Tudo vira string: é o formato em que o formulário e o FormData trabalham. */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return dataParaDia(valor);
  return String(valor);
}

export default async function EditarAlunoPage({
  params,
}: PageProps<"/alunos/[id]/editar">) {
  const usuario = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);
  const { id } = await params;

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    select: selectAlunoPara(usuario.papeis),
  });
  if (!aluno) notFound();

  // Quem chega aqui passou por PODE_CADASTRAR, então a seleção é a completa.
  // A guarda amarra essa certeza ao mesmo predicado que escolheu a seleção.
  if (!ehAlunoCompleto(aluno, usuario.papeis)) notFound();

  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      capacidade: true,
      _count: { select: { alunos: { where: { status: StatusAluno.ATIVO } } } },
    },
  });

  const valores: ValoresAluno = {
    ...VALORES_VAZIOS,
    nome: texto(aluno.nome),
    nascimento: texto(aluno.nascimento),
    turmaId: texto(aluno.turmaId),
    modalidade: texto(aluno.modalidade),
    graduacao: texto(aluno.graduacao),
    grau: texto(aluno.grau),
    sexo: texto(aluno.sexo),
    graduacaoData: texto(aluno.graduacaoData),
    naturalidade: texto(aluno.naturalidade),
    nomePai: texto(aluno.nomePai),
    nomeMae: texto(aluno.nomeMae),
    responsavelTipo: texto(aluno.responsavelTipo),
    responsavelNome: texto(aluno.responsavelNome),
    responsavelParentesco: texto(aluno.responsavelParentesco),
    endereco: texto(aluno.endereco),
    numero: texto(aluno.numero),
    bairro: texto(aluno.bairro),
    cidade: texto(aluno.cidade),
    estado: texto(aluno.estado),
    cep: texto(aluno.cep),
    telefoneResponsavel: texto(aluno.telefoneResponsavel),
    telefoneAluno: texto(aluno.telefoneAluno),
    email: texto(aluno.email),
    rg: texto(aluno.rg),
    rgOrgaoEmissor: texto(aluno.rgOrgaoEmissor),
    rgUf: texto(aluno.rgUf),
    rgDataEmissao: texto(aluno.rgDataEmissao),
    cpf: texto(aluno.cpf),
    escola: texto(aluno.escola),
    serie: texto(aluno.serie),
    peso: texto(aluno.peso),
    altura: texto(aluno.altura),
    tipoSanguineo: texto(aluno.tipoSanguineo),
    alergias: texto(aluno.alergias),
    problemasSaude: texto(aluno.problemasSaude),
    medicamentosContinuos: texto(aluno.medicamentosContinuos),
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href={`/alunos/${aluno.id}`}>{aluno.nome}</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Editar cadastro</h1>
        <p className="text-muted-foreground font-mono text-sm">
          {aluno.matricula}
        </p>
      </div>

      <FormularioAluno
        acao={atualizarAluno}
        alunoId={aluno.id}
        turmas={turmas.map((t) => ({
          id: t.id,
          codigo: t.codigo,
          nome: t.nome,
          capacidade: t.capacidade,
          ocupacao: t._count.alunos,
        }))}
        valores={valores}
        hojeIso={hojeNoProjeto()}
        podeAutorizarCapacidade={ehAdmin(usuario.papeis)}
        hrefCancelar={`/alunos/${aluno.id}`}
        rotuloSalvar="Salvar alterações"
      />
    </section>
  );
}
