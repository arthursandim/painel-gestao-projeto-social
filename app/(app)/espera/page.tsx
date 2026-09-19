import { ModuloPendente } from "@/components/modulo-pendente";

export const metadata = { title: "Lista de espera — Engenho Cidadão" };

export default function Page() {
  return (
    <ModuloPendente
      titulo="Lista de espera"
      fase={7}
      descricao="Fila de espera e conversão em aluno, com autorização quando a turma estiver cheia."
    />
  );
}
