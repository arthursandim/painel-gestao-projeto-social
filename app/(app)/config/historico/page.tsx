import { TipoEventoHistorico, type Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BotaoVoltar } from "@/components/botao-voltar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarMomentoBr } from "@/lib/data";
import { descreverEvento, ROTULO_TIPO_EVENTO, TIPOS_EVENTO } from "@/lib/historico";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Histórico — Engenho Cidadão" };

/** Faltas é parâmetro do projeto, não de turma: filtro próprio. */
const SEM_TURMA = "projeto";
const LIMITE = 500;

export default async function HistoricoPage({ searchParams }: PageProps<"/config/historico">) {
  // O layout de /config já barrou quem não é admin.
  const filtros = await searchParams;
  const turmaFiltro = typeof filtros.turma === "string" ? filtros.turma : "";
  const tipo = TIPOS_EVENTO.find((t) => t === filtros.tipo) ?? null;

  const where: Prisma.EventoHistoricoWhereInput = {
    ...(turmaFiltro === SEM_TURMA ? { turmaId: null } : turmaFiltro ? { turmaId: turmaFiltro } : {}),
    ...(tipo ? { tipo } : {}),
  };

  const [turmas, eventos] = await Promise.all([
    prisma.turma.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.eventoHistorico.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: LIMITE,
      select: {
        id: true,
        tipo: true,
        valorAnterior: true,
        valorNovo: true,
        justificativa: true,
        criadoEm: true,
        turma: { select: { nome: true } },
        // Só matrícula e nome, que todas as visões do aluno mostram; a tela é
        // do admin, que vê o cadastro inteiro.
        aluno: { select: { id: true, matricula: true, nome: true } },
        autor: { select: { nome: true } },
      },
    }),
  ]);

  const linhas = eventos.map((e) => ({
    ...e,
    onde: e.turma?.nome ?? (e.tipo === TipoEventoHistorico.FALTAS_ALTERADO ? "Projeto" : "—"),
    descricao: descreverEvento(e),
    quando: formatarMomentoBr(e.criadoEm),
    quem: e.autor?.nome ?? "—",
  }));

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/config">Configuração</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="text-muted-foreground text-sm">
          Alterações de capacidade das turmas e do número de faltas que dispara
          o alerta, e cada matrícula autorizada acima da capacidade — com quem,
          quando e por quê. Só cresce: nada aqui é editado nem apagado.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-[auto_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Select id="turma" name="turma" defaultValue={turmaFiltro} className="md:w-48">
                <option value="">Todas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
                <option value={SEM_TURMA}>Projeto (faltas)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select id="tipo" name="tipo" defaultValue={tipo ?? ""} className="md:w-64">
                <option value="">Todos</option>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_EVENTO[t]}
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
        {linhas.length === 0
          ? "Nenhum registro com esses filtros."
          : `${linhas.length} ${linhas.length === 1 ? "registro" : "registros"}${linhas.length === LIMITE ? ` (os ${LIMITE} mais recentes)` : ""}.`}
      </p>

      {/* Abaixo de 768 px a tabela vira cartões — nunca rolagem horizontal. */}
      <ul className="space-y-3 md:hidden">
        {linhas.map((l) => (
          <li key={l.id}>
            <Card>
              <CardContent className="space-y-1 pt-6 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloTipo tipo={l.tipo} />
                  <span className="font-medium">{l.onde}</span>
                </div>
                <p>{l.descricao}</p>
                <Aluno aluno={l.aluno} />
                {l.justificativa ? <p>Justificativa: {l.justificativa}</p> : null}
                <p className="text-muted-foreground text-xs">
                  {l.quando} · {l.quem}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        {linhas.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Quando</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Turma</th>
                  <th className="px-3 py-2 font-medium">O que mudou</th>
                  <th className="px-3 py-2 font-medium">Quem</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{l.quando}</td>
                    <td className="px-3 py-2">
                      <SeloTipo tipo={l.tipo} />
                    </td>
                    <td className="px-3 py-2">{l.onde}</td>
                    <td className="space-y-1 px-3 py-2">
                      <p>{l.descricao}</p>
                      <Aluno aluno={l.aluno} />
                      {l.justificativa ? (
                        <p className="text-muted-foreground">Justificativa: {l.justificativa}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{l.quem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SeloTipo({ tipo }: { tipo: TipoEventoHistorico }) {
  return (
    <Badge variant={tipo === TipoEventoHistorico.MATRICULA_ACIMA_CAPACIDADE ? "destructive" : "secondary"}>
      {ROTULO_TIPO_EVENTO[tipo]}
    </Badge>
  );
}

function Aluno({ aluno }: { aluno: { id: string; matricula: string; nome: string } | null }) {
  if (!aluno) return null;
  return (
    <Link href={`/alunos/${aluno.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4 md:min-h-0">
      {aluno.matricula} — {aluno.nome}
    </Link>
  );
}
