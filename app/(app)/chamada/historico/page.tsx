import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BotaoVoltar } from "@/components/botao-voltar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exigirAcesso } from "@/lib/auth";
import { dataParaDia, diaParaData, formatarDiaBr, hojeNoProjeto } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Histórico de chamadas — Engenho Cidadão" };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** `AAAA-MM` deslocado de `n` meses. */
function deslocarMes(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + n, 1));
  return dataParaDia(d).slice(0, 7);
}

/**
 * Chamadas já fechadas, mês a mês.
 *
 * A lista sai dos registros de Presenca agrupados por turma e dia — não de um
 * calendário. Dia sem aula não tem registro e por isso não aparece: abrir uma
 * data na tela de chamada só para olhar não grava nada, e só "Fechar chamada"
 * faz um dia existir aqui.
 */
export default async function HistoricoChamadasPage({
  searchParams,
}: PageProps<"/chamada/historico">) {
  await exigirAcesso("/chamada");
  const params = await searchParams;

  const mesAtual = hojeNoProjeto().slice(0, 7);
  const mes =
    typeof params.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) &&
    params.mes <= mesAtual
      ? params.mes
      : mesAtual;
  const turmaFiltro = typeof params.turma === "string" ? params.turma : "";

  const turmas = await prisma.turma.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, ativa: true },
  });
  const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]));

  const grupos = await prisma.presenca.groupBy({
    by: ["turmaId", "data", "presente"],
    where: {
      data: { gte: diaParaData(`${mes}-01`), lt: diaParaData(`${deslocarMes(mes, 1)}-01`) },
      ...(turmaFiltro ? { turmaId: turmaFiltro } : {}),
    },
    _count: { _all: true },
  });

  type Linha = { turmaId: string; dia: string; presentes: number; ausentes: number };
  const porChave = new Map<string, Linha>();
  for (const g of grupos) {
    const dia = dataParaDia(g.data);
    const chave = `${dia}|${g.turmaId}`;
    const linha = porChave.get(chave) ?? { turmaId: g.turmaId, dia, presentes: 0, ausentes: 0 };
    if (g.presente) linha.presentes += g._count._all;
    else linha.ausentes += g._count._all;
    porChave.set(chave, linha);
  }
  const linhas = [...porChave.values()].sort((a, b) =>
    a.dia !== b.dia
      ? a.dia < b.dia ? 1 : -1
      : (nomeTurma.get(a.turmaId) ?? "").localeCompare(nomeTurma.get(b.turmaId) ?? ""),
  );

  const [ano, m] = mes.split("-").map(Number);
  const anterior = deslocarMes(mes, -1);
  const seguinte = deslocarMes(mes, 1);
  const filtroTurma = turmaFiltro ? `&turma=${turmaFiltro}` : "";

  return (
    <section className="space-y-4">
      <BotaoVoltar href="/chamada">Chamada</BotaoVoltar>

      <div>
        <h1 className="text-2xl font-semibold">Histórico de chamadas</h1>
        <p className="text-muted-foreground text-sm">
          Só aparecem os dias em que uma chamada foi fechada. Toque numa linha para
          abrir e corrigir.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="mes" value={mes} />
            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Select id="turma" name="turma" defaultValue={turmaFiltro}>
                <option value="">Todas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.ativa ? "" : " (inativa)"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="min-h-11 w-full">
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/chamada/historico?mes=${anterior}${filtroTurma}`}>
            <ChevronLeft className="size-4" />
            Anterior
          </Link>
        </Button>
        <p className="font-medium capitalize">
          {MESES[m - 1]} de {ano}
        </p>
        {mes < mesAtual ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/chamada/historico?mes=${seguinte}${filtroTurma}`}>
              Seguinte
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <span className="w-[6.5rem]" aria-hidden />
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma chamada fechada neste mês.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {linhas.map((l) => {
            const semana = DIAS_SEMANA[diaParaData(l.dia).getUTCDay()];
            return (
              <li key={`${l.dia}|${l.turmaId}`}>
                <Link
                  href={`/chamada?turma=${l.turmaId}&data=${l.dia}`}
                  className="hover:bg-muted/40 flex min-h-14 items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {formatarDiaBr(l.dia)} <span className="text-muted-foreground font-normal">({semana})</span>
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {nomeTurma.get(l.turmaId) ?? "Turma removida"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {l.presentes} P
                    </span>
                    {" · "}
                    <span className="text-destructive font-semibold">{l.ausentes} F</span>
                    {" · "}
                    <span className="text-muted-foreground">{l.presentes + l.ausentes}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
