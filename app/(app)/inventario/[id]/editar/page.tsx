import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { editarItem } from "../../acoes";
import { FormularioItem } from "../../formulario-item";
import { BotaoVoltar } from "@/components/botao-voltar";
import { exigirAcesso } from "@/lib/auth";
import { categoriasUsadas, contagemDoItem } from "@/lib/inventario";
import { ehAdmin } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Editar item — Engenho Cidadão" };

export default async function EditarItemPage({ params }: PageProps<"/inventario/[id]/editar">) {
  const usuario = await exigirAcesso("/inventario");
  const { id } = await params;
  // id que não é uuid faria o Prisma lançar erro em vez de não encontrar.
  if (!z.uuid().safeParse(id).success) notFound();

  const [item, contagem, categorias] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        descricao: true,
        categoria: true,
        observacao: true,
        unidadeMedida: true,
        quantidadeMinima: true,
        identificacao: true,
        estadoConservacao: true,
        podeSerEmprestado: true,
      },
    }),
    contagemDoItem(id),
    categoriasUsadas(),
  ]);
  if (!item) notFound();

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/inventario">Inventário</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Editar — {item.descricao}</h1>
        <p className="text-muted-foreground text-sm">
          A quantidade não se edita aqui: ela muda por entrada ou saída de
          estoque, com motivo, na tela do item.
        </p>
      </div>

      <FormularioItem
        acao={editarItem}
        id={item.id}
        categorias={categorias}
        emprestados={contagem.emprestados}
        admin={ehAdmin(usuario.papeis)}
        valores={{
          descricao: item.descricao,
          categoria: item.categoria ?? "",
          observacao: item.observacao ?? "",
          unidadeMedida: item.unidadeMedida,
          quantidadeMinima: String(item.quantidadeMinima),
          identificacao: item.identificacao ?? "",
          estadoConservacao: item.estadoConservacao,
          podeSerEmprestado: item.podeSerEmprestado,
        }}
        cancelar={`/inventario/${item.id}`}
        rotuloSalvar="Salvar alterações"
      />
    </section>
  );
}
