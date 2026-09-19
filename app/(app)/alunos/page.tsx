import { ModuloPendente } from "@/components/modulo-pendente";

export const metadata = { title: "Alunos — Engenho Cidadão" };

export default function Page() {
  return (
    <ModuloPendente
      titulo="Alunos"
      fase={3}
      descricao="Cadastro, lista com busca e filtro, edição e ficha impressa."
    />
  );
}
