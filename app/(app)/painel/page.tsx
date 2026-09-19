import { ModuloPendente } from "@/components/modulo-pendente";

export const metadata = { title: "Painel de pendências — Engenho Cidadão" };

export default function Page() {
  return (
    <ModuloPendente
      titulo="Painel de pendências"
      fase={7}
      descricao="Os cinco alertas e a ocupação de cada turma contra a capacidade configurada."
    />
  );
}
