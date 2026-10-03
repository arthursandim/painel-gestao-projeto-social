"use client";

import { Check, X } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { fecharChamada, type EstadoChamada } from "./acoes";
import type { AlunoNaChamada } from "./dados";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emRiscoDeEvasao } from "@/lib/chamada";
import { cn } from "@/lib/utils";

function Fechar({ fechada }: { fechada: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-12 px-6 text-base">
      {pending ? "Gravando…" : fechada ? "Salvar alterações" : "Fechar chamada"}
    </Button>
  );
}

/**
 * A lista de toque.
 *
 * Feita para 40 crianças no tatame e o professor de pé com o celular: a linha
 * inteira é o alvo (bem acima dos 44 px), um toque alterna presente/ausente, e
 * o contador e o botão ficam presos no rodapé da tela, à mão do polegar, sem
 * rolar até o fim.
 */
export function ListaChamada({
  turmaId,
  data,
  fechada,
  limiar,
  alunos,
}: {
  turmaId: string;
  data: string;
  fechada: boolean;
  limiar: number;
  alunos: AlunoNaChamada[];
}) {
  const [ausentes, setAusentes] = useState(
    () => new Set(alunos.filter((a) => !a.presente).map((a) => a.id)),
  );
  const [estado, acao] = useActionState<EstadoChamada, FormData>(fecharChamada, {});

  function alternar(id: string) {
    setAusentes((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const total = alunos.length;
  const nAusentes = alunos.filter((a) => ausentes.has(a.id)).length;

  return (
    <form action={acao} className="space-y-3 pb-28">
      <input type="hidden" name="turmaId" value={turmaId} />
      <input type="hidden" name="data" value={data} />
      {alunos.map((a) => (
        <input key={a.id} type="hidden" name="alunoId" value={a.id} />
      ))}
      {[...ausentes].map((id) => (
        <input key={id} type="hidden" name="ausente" value={id} />
      ))}

      <ul className="divide-y rounded-lg border">
        {alunos.map((a) => {
          const ausente = ausentes.has(a.id);
          const risco = emRiscoDeEvasao(a.faltas, limiar);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={ausente}
                onClick={() => alternar(a.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                  ausente
                    ? "bg-destructive/10 text-destructive"
                    : "hover:bg-muted/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    ausente
                      ? "border-destructive bg-destructive text-white"
                      : "border-emerald-600 bg-emerald-600 text-white",
                  )}
                >
                  {ausente ? <X className="size-5" /> : <Check className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", ausente && "line-through")}>
                    {a.nome}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {a.matricula} · {ausente ? "Ausente" : "Presente"}
                  </span>
                </span>
                {risco ? (
                  <Badge variant="destructive" className="shrink-0">
                    {a.faltas} faltas seguidas
                  </Badge>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      {estado.ok ? (
        <Alert role="status">
          <AlertDescription>{estado.ok}</AlertDescription>
        </Alert>
      ) : null}

      {/* Rodapé fixo: contador sempre visível e o botão no alcance do polegar. */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm" aria-live="polite">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {total - nAusentes} presentes
            </span>
            {" · "}
            <span className="text-destructive font-semibold">{nAusentes} ausentes</span>
            {" · "}
            <span className="text-muted-foreground">{total} total</span>
          </p>
          <Fechar fechada={fechada} />
        </div>
      </div>
    </form>
  );
}
