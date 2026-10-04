import type { Metadata } from "next";

import { FormParametros } from "./formulario";
import { BotaoVoltar } from "@/components/botao-voltar";
import { CHAVE_FALTAS_ALERTA, limiarFaltas } from "@/lib/chamada";
import { formatarMomentoBr } from "@/lib/data";
import { ocupacaoDasTurmas } from "@/lib/ocupacao";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Parâmetros — Engenho Cidadão" };

function autoria(nome: string | null | undefined, em: Date): string {
  return nome
    ? `Alterado por ${nome} em ${formatarMomentoBr(em)}.`
    : "Valor inicial, sem alteração pela tela.";
}

export default async function ParametrosPage() {
  // O layout de /config já barrou quem não é admin.
  const [ocupacao, turmas, config] = await Promise.all([
    ocupacaoDasTurmas(),
    prisma.turma.findMany({
      where: { ativa: true },
      select: {
        id: true,
        atualizadoEm: true,
        atualizadoPor: { select: { nome: true } },
      },
    }),
    prisma.configuracao.findUnique({
      where: { chave: CHAVE_FALTAS_ALERTA },
      select: {
        valor: true,
        atualizadoEm: true,
        atualizadoPor: { select: { nome: true } },
      },
    }),
  ]);

  const autoriaTurma = new Map(
    turmas.map((t) => [t.id, autoria(t.atualizadoPor?.nome, t.atualizadoEm)]),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/config">Configuração</BotaoVoltar>
        <h1 className="text-2xl font-semibold">Parâmetros</h1>
        <p className="text-muted-foreground text-sm">
          Capacidade de cada turma e o número de faltas consecutivas que coloca
          o aluno no alerta de risco de evasão. O alerta só sinaliza: ninguém é
          desligado nem movido por causa destes números.
        </p>
      </div>

      <FormParametros
        turmas={ocupacao.map((t) => ({
          id: t.id,
          nome: t.nome,
          capacidade: t.capacidade,
          ativos: t.ativos,
          autoria: autoriaTurma.get(t.id) ?? "",
        }))}
        faltas={limiarFaltas(config?.valor)}
        autoriaFaltas={
          config ? autoria(config.atualizadoPor?.nome, config.atualizadoEm) : ""
        }
      />
    </section>
  );
}
