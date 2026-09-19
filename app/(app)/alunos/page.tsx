import { StatusAluno, type Prisma } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SeloDeAvisos } from "./avisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exigirAcesso } from "@/lib/auth";
import { avisosDoAluno } from "@/lib/avisosAluno";
import { dataParaDia, formatarDiaBr, hojeNoProjeto, idadeHoje } from "@/lib/data";
import { descreverGraduacao } from "@/lib/graduacao";
import { podeEscreverAluno } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { selectAlunoPara } from "@/lib/selecaoAluno";

export const metadata: Metadata = { title: "Alunos — Engenho Cidadão" };

const FILTROS_STATUS = [
  { valor: "ATIVO", rotulo: "Ativos" },
  { valor: "DESLIGADO", rotulo: "Desligados" },
  { valor: "TODOS", rotulo: "Todos" },
] as const;

export default async function AlunosPage({ searchParams }: PageProps<"/alunos">) {
  const usuario = await exigirAcesso("/alunos");
  const filtros = await searchParams;

  const q = typeof filtros.q === "string" ? filtros.q.trim() : "";
  const turmaFiltro = typeof filtros.turma === "string" ? filtros.turma : "";
  const status =
    typeof filtros.status === "string" &&
    FILTROS_STATUS.some((f) => f.valor === filtros.status)
      ? filtros.status
      : "ATIVO";

  const podeCadastrar = podeEscreverAluno(usuario.papeis);

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

  const where: Prisma.AlunoWhereInput = {
    ...(status === "TODOS" ? {} : { status: status as StatusAluno }),
    ...(turmaFiltro ? { turmaId: turmaFiltro } : {}),
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { matricula: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // O seletor único decide os campos. Nunca monte `select` à mão aqui: a tela
  // do professor precisa que a API devolva menos, não que o React esconda mais.
  const alunos = await prisma.aluno.findMany({
    where,
    orderBy: { nome: "asc" },
    select: selectAlunoPara(usuario.papeis),
  });

  const hoje = hojeNoProjeto();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-muted-foreground text-sm">
            {podeCadastrar
              ? "Cadastro, busca e edição. Nada é apagado: quem sai é desligado e a vaga fica livre."
              : "Consulta. Telefone, endereço, documentos e escola não aparecem nesta visão."}
          </p>
        </div>
        {podeCadastrar ? (
          <Button asChild className="min-h-11">
            <Link href="/alunos/novo">
              <Plus className="size-4" />
              Novo aluno
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Ocupação contra a capacidade configurada. A turma acima do limite
          aparece destacada — a exceção precisa ficar visível. */}
      <div className="flex flex-wrap gap-2">
        {turmas.map((turma) => {
          const ocupacao = turma._count.alunos;
          const acima = ocupacao > turma.capacidade;
          return (
            <Badge
              key={turma.id}
              variant={acima ? "destructive" : "secondary"}
              className="h-7"
            >
              {turma.nome}: {ocupacao}/{turma.capacidade}
              {acima ? " — acima da capacidade" : ""}
            </Badge>
          );
        })}
      </div>

      {/* Busca por GET: o filtro fica na URL, então o botão voltar do
          navegador funciona e o link pode ser guardado. Sem JavaScript. */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nome ou matrícula"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Select
                id="turma"
                name="turma"
                defaultValue={turmaFiltro}
                className="md:w-48"
              >
                <option value="">Todas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Situação</Label>
              <Select
                id="status"
                name="status"
                defaultValue={status}
                className="md:w-40"
              >
                {FILTROS_STATUS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="min-h-11 w-full">
                <Search className="size-4" />
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        {alunos.length === 0
          ? "Nenhum aluno com esses filtros."
          : `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}.`}
      </p>

      {/* Abaixo de 768 px a tabela vira cartões empilhados — nunca rolagem
          horizontal. São as duas faces da mesma lista, não duas telas. */}
      <ul className="space-y-3 md:hidden">
        {alunos.map((aluno) => {
          const avisos = avisosDoAluno(
            { ...aluno, nascimento: dataParaDia(aluno.nascimento) },
            hoje,
          );
          return (
            <li key={aluno.id}>
              <Link href={`/alunos/${aluno.id}`} className="block">
                <Card className="hover:bg-muted/40 transition-colors">
                  <CardContent className="space-y-1 pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{aluno.nome}</span>
                      <SeloDeAvisos quantidade={avisos.length} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {aluno.matricula} · {aluno.turma.nome} ·{" "}
                      {idadeHoje(aluno.nascimento, hoje)} anos
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {descreverGraduacao(aluno.graduacao, aluno.grau)}
                    </p>
                    {aluno.status === StatusAluno.DESLIGADO ? (
                      <Badge variant="outline">Desligado</Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        {alunos.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Matrícula</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Turma</th>
                  <th className="px-3 py-2 font-medium">Nascimento</th>
                  <th className="px-3 py-2 font-medium">Idade</th>
                  <th className="px-3 py-2 font-medium">Graduação</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const avisos = avisosDoAluno(
                    { ...aluno, nascimento: dataParaDia(aluno.nascimento) },
                    hoje,
                  );
                  return (
                    <tr key={aluno.id} className="hover:bg-muted/40 border-t">
                      <td className="px-3 py-2 font-mono text-xs">
                        {aluno.matricula}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/alunos/${aluno.id}`}
                          className="flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                        >
                          {aluno.nome}
                          <SeloDeAvisos quantidade={avisos.length} />
                        </Link>
                      </td>
                      <td className="px-3 py-2">{aluno.turma.nome}</td>
                      <td className="px-3 py-2">
                        {formatarDiaBr(aluno.nascimento)}
                      </td>
                      <td className="px-3 py-2">
                        {idadeHoje(aluno.nascimento, hoje)}
                      </td>
                      <td className="px-3 py-2">
                        {descreverGraduacao(aluno.graduacao, aluno.grau)}
                      </td>
                      <td className="px-3 py-2">
                        {aluno.status === StatusAluno.ATIVO ? (
                          <Badge variant="secondary">Ativo</Badge>
                        ) : (
                          <Badge variant="outline">Desligado</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
