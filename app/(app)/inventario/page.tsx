import { ModuloPendente } from "@/components/modulo-pendente";

export const metadata = { title: "Inventário — Engenho Cidadão" };

export default function Page() {
  return (
    <ModuloPendente
      titulo="Inventário"
      fase={8}
      descricao="Itens, empréstimos e movimentos de estoque."
    />
  );
}
