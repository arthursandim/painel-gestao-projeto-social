import { EstadoConservacao } from "@prisma/client";
import type { Metadata } from "next";

import { criarItem } from "../acoes";
import { FormularioItem } from "../formulario-item";
import { BotaoVoltar } from "@/components/botao-voltar";
import { exigirAcesso } from "@/lib/auth";
import { categoriasUsadas } from "@/lib/inventario";
import { ehAdmin } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Novo item — Engenho Cidadão" };

export default async function NovoItemPage() {
  const usuario = await exigirAcesso("/inventario");
  const categorias = await categoriasUsadas();

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/inventario">Inventário</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Novo item</h1>
        <p className="text-muted-foreground text-sm">
          Um cadastro só para tudo. O que varia é se o item pode ser emprestado.
        </p>
      </div>

      <FormularioItem
        acao={criarItem}
        categorias={categorias}
        admin={ehAdmin(usuario.papeis)}
        valores={{
          descricao: "",
          categoria: "",
          observacao: "",
          unidadeMedida: "un",
          quantidadeMinima: "0",
          identificacao: "",
          estadoConservacao: EstadoConservacao.BOM,
          podeSerEmprestado: false,
        }}
        cancelar="/inventario"
        rotuloSalvar="Cadastrar item"
      />
    </section>
  );
}
