import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ItemChamada } from "../linha-chamada";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exigirAcesso } from "@/lib/auth";
import { dataParaDia, hojeNoProjeto } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resumoDasChamadas } from "@/lib/resumoChamadas";

export const metadata: Metadata = { title: "Histórico de chamadas — Engenho Cidadão" };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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

  const linhas = await resumoDasChamadas({
    de: `${mes}-01`,
    ate: `${deslocarMes(mes, 1)}-01`,
    turmaId: turmaFiltro || undefined,
    nomeTurma,
  });

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
          {linhas.map((l) => (
            <ItemChamada
              key={`${l.dia}|${l.turmaId}`}
              linha={l}
              nomeTurma={nomeTurma.get(l.turmaId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
