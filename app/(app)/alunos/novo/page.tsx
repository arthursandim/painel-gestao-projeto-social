import { StatusAluno, StatusListaEspera } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { criarAluno } from "../acoes";
import { FormularioAluno, VALORES_VAZIOS, type ValoresAluno } from "../formulario-aluno";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { exigirPapeis } from "@/lib/auth";
import { IDADE_MAIORIDADE } from "@/lib/avisosAluno";
import { dataParaDia, formatarDiaBr, hojeNoProjeto, idadeEm } from "@/lib/data";
import { ehAdmin, PAPEIS_ESCRITA_ALUNO } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Novo aluno — Engenho Cidadão" };

/**
 * O registro da lista de espera que está sendo convertido, se houver.
 *
 * A pré-carga é só conveniência: quem garante que o registro ainda aguarda é a
 * transação em `criarAluno`, não esta leitura.
 */
async function carregarEspera(id: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return null;
  return prisma.listaEspera.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      nascimento: true,
      telefone: true,
      turmaPretendidaId: true,
      dataEntrada: true,
      status: true,
      aluno: { select: { id: true, matricula: true } },
    },
  });
}

export default async function NovoAlunoPage({ searchParams }: PageProps<"/alunos/novo">) {
  // O layout de /alunos deixa o professor entrar, porque ele consulta alunos.
  // Cadastrar é outra coisa, então a guarda desta subtela é própria e mais
  // estreita — e roda no servidor, antes de existir HTML.
  const usuario = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);
  const params = await searchParams;
  const hoje = hojeNoProjeto();

  const [turmas, espera] = await Promise.all([
    prisma.turma.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        codigo: true,
        nome: true,
        capacidade: true,
        _count: { select: { alunos: { where: { status: StatusAluno.ATIVO } } } },
      },
    }),
    carregarEspera(params.espera),
  ]);

  const convertendo = espera?.status === StatusListaEspera.AGUARDANDO ? espera : null;
  const voltarPara = espera ? "/espera" : "/alunos";

  let valores: ValoresAluno = VALORES_VAZIOS;
  if (convertendo) {
    const nascimento = dataParaDia(convertendo.nascimento);
    const adulto = idadeEm(nascimento, hoje) >= IDADE_MAIORIDADE;
    valores = {
      ...VALORES_VAZIOS,
      nome: convertendo.nome,
      nascimento,
      turmaId: convertendo.turmaPretendidaId ?? "",
      // O telefone da fila é de contato: do responsável para criança, do
      // próprio aluno para adulto.
      ...(adulto
        ? { telefoneAluno: convertendo.telefone ?? "" }
        : { telefoneResponsavel: convertendo.telefone ?? "" }),
    };
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href={voltarPara}>{espera ? "Lista de espera" : "Alunos"}</BotaoVoltar>
        <h1 className="text-2xl font-semibold">
          {convertendo ? "Converter em aluno" : "Novo aluno"}
        </h1>
        <p className="text-muted-foreground text-sm">
          A matrícula é gerada no momento de salvar. Campos em branco não
          impedem o cadastro — aparecem depois no painel de pendências.
        </p>
      </div>

      {espera && !convertendo ? (
        <Alert variant="destructive">
          <AlertDescription>
            {espera.nome} não está mais aguardando na fila
            {espera.aluno ? (
              <>
                {" "}— já foi convertido em{" "}
                <Link href={`/alunos/${espera.aluno.id}`} className="underline">
                  {espera.aluno.matricula}
                </Link>
                .
              </>
            ) : (
              " — foi removido."
            )}{" "}
            O formulário abaixo é de um cadastro novo, sem vínculo com a fila.
          </AlertDescription>
        </Alert>
      ) : null}

      {convertendo ? (
        <Alert>
          <AlertDescription>
            Vindo da lista de espera, na fila desde{" "}
            {formatarDiaBr(convertendo.dataEntrada)}. Nome, nascimento, turma e
            telefone já vieram preenchidos e podem ser corrigidos — o registro
            da fila guarda o que foi informado lá. Ao salvar, ele sai da fila
            como convertido, apontando para este aluno.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormularioAluno
        acao={criarAluno}
        turmas={turmas.map((t) => ({
          id: t.id,
          codigo: t.codigo,
          nome: t.nome,
          capacidade: t.capacidade,
          ocupacao: t._count.alunos,
        }))}
        valores={valores}
        esperaId={convertendo?.id}
        hojeIso={hoje}
        podeAutorizarCapacidade={ehAdmin(usuario.papeis)}
        hrefCancelar={voltarPara}
        rotuloSalvar={convertendo ? "Cadastrar e tirar da fila" : "Cadastrar aluno"}
      />
    </section>
  );
}
