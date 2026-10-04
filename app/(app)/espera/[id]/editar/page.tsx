import { StatusListaEspera } from "@prisma/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { editarEspera } from "../../acoes";
import { turmasDaEspera } from "../../dados";
import { FormularioEspera } from "../../formulario-espera";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dataParaDia, hojeNoProjeto } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Editar lista de espera — Engenho Cidadão" };

export default async function EditarEsperaPage({
  params,
}: PageProps<"/espera/[id]/editar">) {
  const { id } = await params;
  // id que não é uuid faria o Prisma lançar erro em vez de não encontrar.
  if (!z.uuid().safeParse(id).success) notFound();

  const [registro, turmas] = await Promise.all([
    prisma.listaEspera.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        nascimento: true,
        telefone: true,
        turmaPretendidaId: true,
        dataEntrada: true,
        observacao: true,
        status: true,
      },
    }),
    turmasDaEspera(),
  ]);
  if (!registro) notFound();

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/espera">Lista de espera</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Editar — {registro.nome}</h1>
      </div>

      {registro.status === StatusListaEspera.AGUARDANDO ? (
        <FormularioEspera
          acao={editarEspera}
          turmas={turmas}
          id={registro.id}
          valores={{
            nome: registro.nome,
            nascimento: dataParaDia(registro.nascimento),
            telefone: registro.telefone ?? "",
            turmaPretendidaId: registro.turmaPretendidaId ?? "",
            dataEntrada: dataParaDia(registro.dataEntrada),
            observacao: registro.observacao ?? "",
          }}
          hojeIso={hojeNoProjeto()}
          rotuloSalvar="Salvar alterações"
        />
      ) : (
        <Alert>
          <AlertDescription>
            Este registro já saiu da fila e não é mais editável: ele guarda o
            que foi informado na época.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
