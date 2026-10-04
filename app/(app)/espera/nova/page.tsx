import type { Metadata } from "next";

import { criarEspera } from "../acoes";
import { turmasDaEspera } from "../dados";
import { FormularioEspera } from "../formulario-espera";
import { BotaoVoltar } from "@/components/botao-voltar";
import { hojeNoProjeto } from "@/lib/data";

export const metadata: Metadata = { title: "Entrada na lista de espera — Engenho Cidadão" };

export default async function NovaEsperaPage() {
  // O layout de /espera já barrou quem não é ADMIN nem INSCRICOES.
  const turmas = await turmasDaEspera();
  const hoje = hojeNoProjeto();

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/espera">Lista de espera</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Entrada na lista de espera</h1>
        <p className="text-muted-foreground text-sm">
          Dados mínimos — a pessoa ainda não é aluno. O cadastro completo é
          feito na conversão, quando abrir a vaga.
        </p>
      </div>

      <FormularioEspera
        acao={criarEspera}
        turmas={turmas}
        valores={{
          nome: "",
          nascimento: "",
          telefone: "",
          turmaPretendidaId: "",
          dataEntrada: hoje,
          observacao: "",
        }}
        hojeIso={hoje}
        rotuloSalvar="Incluir na fila"
      />
    </section>
  );
}
