import { StatusEmprestimo } from "@prisma/client";
import Link from "next/link";

import { AcoesEmprestimo } from "./acoes-emprestimo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDiaBr } from "@/lib/data";
import { ROTULO_STATUS_EMPRESTIMO } from "@/lib/estoque";
import type { EmprestimoTela } from "@/lib/inventario";

/**
 * Empréstimos em cartões — mesma forma no celular e no computador, sem rolagem
 * horizontal. Recebe a forma da tela (lib/inventario.ts), já com o aluno
 * projetado na visão do inventário.
 */
export function ListaEmprestimos({
  emprestimos,
  hojeIso,
  mostrarItem = false,
}: {
  emprestimos: readonly EmprestimoTela[];
  hojeIso: string;
  mostrarItem?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {emprestimos.map((e) => {
        const aberto = e.status === StatusEmprestimo.EMPRESTADO;
        const { aluno } = e;
        return (
          <li key={e.id}>
            <Card>
              <CardContent className="space-y-2 pt-6 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {mostrarItem ? (
                    <Link
                      href={`/inventario/${e.item.id}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {e.item.descricao}
                      {e.item.identificacao ? ` (${e.item.identificacao})` : ""}
                    </Link>
                  ) : null}
                  <Badge
                    variant={
                      e.status === StatusEmprestimo.PERDIDO
                        ? "destructive"
                        : aberto
                          ? "default"
                          : "secondary"
                    }
                  >
                    {ROTULO_STATUS_EMPRESTIMO[e.status]}
                  </Badge>
                  {/* Sinaliza, não age: nada é devolvido sozinho. */}
                  {aberto && !aluno.ativo ? (
                    <Badge variant="destructive">Aluno desligado</Badge>
                  ) : null}
                </div>

                <p>
                  <span className="font-medium">{aluno.nome}</span>{" "}
                  <span className="text-muted-foreground">
                    {aluno.matricula} · {aluno.turma}
                  </span>
                </p>
                {aberto ? <Contato aluno={aluno} /> : null}

                <p className="text-muted-foreground text-xs">
                  Emprestado em {formatarDiaBr(e.dataEmprestimo)}
                  {e.emprestadoPor ? ` por ${e.emprestadoPor}` : ""}
                  {e.status === StatusEmprestimo.DEVOLVIDO && e.dataDevolucao
                    ? ` · devolvido em ${formatarDiaBr(e.dataDevolucao)}${e.recebidoPor ? `, recebido por ${e.recebidoPor}` : ""}`
                    : ""}
                  {e.status === StatusEmprestimo.PERDIDO
                    ? " · perda registrada como saída no estoque do item"
                    : ""}
                </p>
                {e.observacao ? <p className="whitespace-pre-line">{e.observacao}</p> : null}

                {aberto ? (
                  <div className="pt-1">
                    <AcoesEmprestimo
                      emprestimoId={e.id}
                      dataEmprestimo={e.dataEmprestimo}
                      hojeIso={hojeIso}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** Menor: o responsável. Adulto: o próprio aluno. Só enquanto o item está fora. */
function Contato({ aluno }: { aluno: EmprestimoTela["aluno"] }) {
  const { contato } = aluno;
  const quem = aluno.menor
    ? contato.nome
      ? `Responsável: ${contato.nome}${contato.parentesco ? ` (${contato.parentesco})` : ""}`
      : "Responsável não informado"
    : "Telefone do aluno";
  return (
    <p className="text-muted-foreground">
      {quem} ·{" "}
      {contato.telefone ? (
        <a
          href={`tel:${contato.telefone.replace(/\D/g, "")}`}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {contato.telefone}
        </a>
      ) : (
        "sem telefone"
      )}
    </p>
  );
}
