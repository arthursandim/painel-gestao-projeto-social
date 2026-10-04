import { StatusAluno, StatusEmprestimo, type Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import type { Metadata } from "next";

import { ListaEmprestimos } from "../lista-emprestimos";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { hojeNoProjeto } from "@/lib/data";
import { emprestimosParaTela } from "@/lib/inventario";

export const metadata: Metadata = { title: "Empréstimos — Engenho Cidadão" };

const FILTROS_STATUS = [
  { valor: StatusEmprestimo.EMPRESTADO, rotulo: "Em aberto" },
  { valor: StatusEmprestimo.DEVOLVIDO, rotulo: "Devolvidos" },
  { valor: StatusEmprestimo.PERDIDO, rotulo: "Perdidos" },
  { valor: "TODOS", rotulo: "Todos" },
] as const;

export default async function EmprestimosPage({
  searchParams,
}: PageProps<"/inventario/emprestimos">) {
  // O layout de /inventario já barrou quem não é ADMIN nem INVENTARIO.
  const filtros = await searchParams;
  const status =
    FILTROS_STATUS.find((f) => f.valor === filtros.status)?.valor ?? StatusEmprestimo.EMPRESTADO;
  // Aluno desligado com item emprestado: o caso que alguém precisa cobrar.
  // Só faz sentido com o empréstimo em aberto.
  const desligado = filtros.desligado === "1";

  const where: Prisma.EmprestimoWhereInput = desligado
    ? { status: StatusEmprestimo.EMPRESTADO, aluno: { status: StatusAluno.DESLIGADO } }
    : status === "TODOS"
      ? {}
      : { status };

  const emprestimos = await emprestimosParaTela(where);

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/inventario">Inventário</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Empréstimos</h1>
        <p className="text-muted-foreground text-sm">
          Com quem está cada item. Devolução e perda se registram aqui ou na
          tela do item.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-[auto_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="status">Situação</Label>
              <Select id="status" name="status" defaultValue={status} className="md:w-44">
                {FILTROS_STATUS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="desligado"
                  value="1"
                  defaultChecked={desligado}
                  className="size-5"
                />
                Só aluno desligado com item em aberto
              </label>
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
        {emprestimos.length === 0
          ? "Nenhum empréstimo com esses filtros."
          : `${emprestimos.length} ${emprestimos.length === 1 ? "empréstimo" : "empréstimos"}.`}
      </p>

      <ListaEmprestimos emprestimos={emprestimos} hojeIso={hojeNoProjeto()} mostrarItem />
    </section>
  );
}
