import { ModuloPendente } from "@/components/modulo-pendente";

export const metadata = { title: "Chamada — Engenho Cidadão" };

export default function Page() {
  return (
    <ModuloPendente
      titulo="Chamada"
      fase={6}
      descricao="Turma e data, todos presentes por default, um toque por falta."
    />
  );
}
