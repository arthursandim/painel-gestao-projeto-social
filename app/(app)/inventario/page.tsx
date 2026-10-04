import type { Prisma } from "@prisma/client";
import { HandHelping, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { abaixoDoMinimo, CONTAGEM_ZERADA, ROTULO_ESTADO } from "@/lib/estoque";
import { categoriasUsadas, contagensDosItens } from "@/lib/inventario";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Inventário — Engenho Cidadão" };

const FILTROS_SITUACAO = [
  { valor: "ATIVO", rotulo: "Ativos" },
  { valor: "INATIVO", rotulo: "Inativos" },
  { valor: "TODOS", rotulo: "Todos" },
] as const;

export default async function InventarioPage({ searchParams }: PageProps<"/inventario">) {
  // O layout de /inventario já barrou quem não é ADMIN nem INVENTARIO.
  const filtros = await searchParams;
  const q = typeof filtros.q === "string" ? filtros.q.trim() : "";
  const categoria = typeof filtros.categoria === "string" ? filtros.categoria : "";
  const situacao =
    FILTROS_SITUACAO.find((f) => f.valor === filtros.situacao)?.valor ?? "ATIVO";
  const baixo = filtros.baixo === "1";

  const where: Prisma.ItemWhereInput = {
    ...(situacao === "TODOS" ? {} : { ativo: situacao === "ATIVO" }),
    ...(categoria ? { categoria } : {}),
    ...(q
      ? {
          OR: [
            { descricao: { contains: q, mode: "insensitive" } },
            { identificacao: { contains: q, mode: "insensitive" } },
            { categoria: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [encontrados, categorias] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ categoria: "asc" }, { descricao: "asc" }],
      select: {
        id: true,
        descricao: true,
        categoria: true,
        identificacao: true,
        unidadeMedida: true,
        quantidadeMinima: true,
        estadoConservacao: true,
        podeSerEmprestado: true,
        ativo: true,
      },
    }),
    categoriasUsadas(),
  ]);

  // Duas consultas agregadas para a lista inteira, não uma por item.
  const contagens = await contagensDosItens(encontrados.map((i) => i.id));
  const linhas = encontrados
    .map((item) => {
      const c = contagens.get(item.id) ?? CONTAGEM_ZERADA;
      return { ...item, ...c, baixo: abaixoDoMinimo(c.total, item.quantidadeMinima) };
    })
    .filter((l) => !baixo || l.baixo);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventário</h1>
          <p className="text-muted-foreground text-sm">
            Itens, estoque e empréstimos. A quantidade muda só por entrada ou
            saída, com motivo; nada é apagado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/inventario/emprestimos">
              <HandHelping className="size-4" />
              Empréstimos
            </Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/inventario/novo">
              <Plus className="size-4" />
              Novo item
            </Link>
          </Button>
        </div>
      </div>

      {/* Busca por GET: o filtro fica na URL, como na lista de alunos. */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Descrição, identificação ou categoria"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" defaultValue={categoria} className="md:w-44">
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select id="situacao" name="situacao" defaultValue={situacao} className="md:w-36">
                {FILTROS_SITUACAO.map((f) => (
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
                  name="baixo"
                  value="1"
                  defaultChecked={baixo}
                  className="size-5"
                />
                Só abaixo do mínimo
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
        {linhas.length === 0
          ? "Nenhum item com esses filtros."
          : `${linhas.length} ${linhas.length === 1 ? "item" : "itens"}.`}
        {baixo ? " Itens cujo total está abaixo da quantidade mínima cadastrada." : ""}
      </p>

      {/* Abaixo de 768 px a tabela vira cartões empilhados — nunca rolagem
          horizontal. */}
      <ul className="space-y-3 md:hidden">
        {linhas.map((l) => (
          <li key={l.id}>
            <Link href={`/inventario/${l.id}`} className="block">
              <Card className="hover:bg-muted/40 transition-colors">
                <CardContent className="space-y-1 pt-6">
                  <span className="font-medium">{l.descricao}</span>
                  <p className="text-muted-foreground text-sm">
                    {[l.categoria, l.identificacao, ROTULO_ESTADO[l.estadoConservacao]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-sm tabular-nums">
                    Total {l.total} · disponível {l.disponivel}
                    {l.podeSerEmprestado || l.emprestados > 0 ? ` · emprestado ${l.emprestados}` : ""}{" "}
                    <span className="text-muted-foreground">{l.unidadeMedida}</span>
                  </p>
                  <Selos {...l} />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        {linhas.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Disponível</th>
                  <th className="px-3 py-2 text-right font-medium">Emprestado</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40 border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/inventario/${l.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {l.descricao}
                      </Link>
                      {l.identificacao ? (
                        <span className="text-muted-foreground block font-mono text-xs">
                          {l.identificacao}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{l.categoria ?? "—"}</td>
                    <td className="px-3 py-2">{ROTULO_ESTADO[l.estadoConservacao]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.total} <span className="text-muted-foreground text-xs">{l.unidadeMedida}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.disponivel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.podeSerEmprestado || l.emprestados > 0 ? l.emprestados : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Selos {...l} />
                    </td>
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

function Selos({
  ativo,
  podeSerEmprestado,
  baixo,
}: {
  ativo: boolean;
  podeSerEmprestado: boolean;
  baixo: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ativo ? null : <Badge variant="outline">Inativo</Badge>}
      {podeSerEmprestado ? <Badge variant="secondary">Emprestável</Badge> : null}
      {baixo ? <Badge variant="destructive">Abaixo do mínimo</Badge> : null}
    </div>
  );
}
