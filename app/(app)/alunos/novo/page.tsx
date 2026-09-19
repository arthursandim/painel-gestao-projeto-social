import { StatusAluno } from "@prisma/client";
import type { Metadata } from "next";

import { criarAluno } from "../acoes";
import { FormularioAluno, VALORES_VAZIOS } from "../formulario-aluno";
import { BotaoVoltar } from "@/components/botao-voltar";
import { exigirPapeis } from "@/lib/auth";
import { hojeNoProjeto } from "@/lib/data";
import { ehAdmin, PAPEIS_ESCRITA_ALUNO } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Novo aluno — Engenho Cidadão" };

export default async function NovoAlunoPage() {
  // O layout de /alunos deixa o professor entrar, porque ele consulta alunos.
  // Cadastrar é outra coisa, então a guarda desta subtela é própria e mais
  // estreita — e roda no servidor, antes de existir HTML.
  const usuario = await exigirPapeis(PAPEIS_ESCRITA_ALUNO);

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

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/alunos">Alunos</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Novo aluno</h1>
        <p className="text-muted-foreground text-sm">
          A matrícula é gerada no momento de salvar. Campos em branco não
          impedem o cadastro — aparecem depois no painel de pendências.
        </p>
      </div>

      <FormularioAluno
        acao={criarAluno}
        turmas={turmas.map((t) => ({
          id: t.id,
          codigo: t.codigo,
          nome: t.nome,
          capacidade: t.capacidade,
          ocupacao: t._count.alunos,
        }))}
        valores={VALORES_VAZIOS}
        hojeIso={hojeNoProjeto()}
        podeAutorizarCapacidade={ehAdmin(usuario.papeis)}
        hrefCancelar="/alunos"
        rotuloSalvar="Cadastrar aluno"
      />
    </section>
  );
}
