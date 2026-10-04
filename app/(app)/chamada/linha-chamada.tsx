import Link from "next/link";

import { diaParaData, formatarDiaBr } from "@/lib/data";
import type { LinhaChamada } from "@/lib/resumoChamadas";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Uma chamada fechada: dia, turma, presentes, faltas e total. Tocar abre a
 * chamada em modo edição. Usada no histórico e nas chamadas da semana do
 * painel, para as duas telas mostrarem a mesma coisa do mesmo jeito.
 */
export function ItemChamada({
  linha,
  nomeTurma,
}: {
  linha: LinhaChamada;
  nomeTurma: string | undefined;
}) {
  const semana = DIAS_SEMANA[diaParaData(linha.dia).getUTCDay()];
  return (
    <li>
      <Link
        href={`/chamada?turma=${linha.turmaId}&data=${linha.dia}`}
        className="hover:bg-muted/40 flex min-h-14 items-center justify-between gap-3 px-3 py-2"
      >
        <span className="min-w-0">
          <span className="block font-medium">
            {formatarDiaBr(linha.dia)}{" "}
            <span className="text-muted-foreground font-normal">({semana})</span>
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {nomeTurma ?? "Turma removida"}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {linha.presentes} P
          </span>
          {" · "}
          <span className="text-destructive font-semibold">{linha.ausentes} F</span>
          {" · "}
          <span className="text-muted-foreground">{linha.presentes + linha.ausentes}</span>
        </span>
      </Link>
    </li>
  );
}
