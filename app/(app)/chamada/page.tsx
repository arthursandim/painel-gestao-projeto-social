import type { Metadata } from "next";

import { carregarChamada } from "./dados";
import { ListaChamada } from "./lista-chamada";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exigirAcesso } from "@/lib/auth";
import { situacaoDoDia } from "@/lib/chamada";
import { formatarDiaBr, formatarMomentoBr, hojeNoProjeto } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Chamada — Engenho Cidadão" };

export default async function ChamadaPage({ searchParams }: PageProps<"/chamada">) {
  const usuario = await exigirAcesso("/chamada");
  const params = await searchParams;

  // "Hoje" no fuso do projeto, nunca o do servidor (UTC na Vercel).
  const hoje = hojeNoProjeto();
  const dia = typeof params.data === "string" && params.data ? params.data : hoje;

  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  // Com uma turma só, ela já vem escolhida. Com mais, a pessoa escolhe: abrir
  // na turma errada e fechar sem perceber gravaria 40 presenças trocadas.
  const turmaParam = typeof params.turma === "string" ? params.turma : "";
  const turma =
    turmas.find((t) => t.id === turmaParam) ?? (turmas.length === 1 ? turmas[0] : null);

  const situacao = situacaoDoDia(dia, hoje);
  const chamada =
    turma && situacao.ok ? await carregarChamada(turma.id, dia, usuario.papeis) : null;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Chamada</h1>
        <p className="text-muted-foreground text-sm">
          Todos começam presentes. Toque só em quem faltou.
        </p>
      </div>

      {/* GET: turma e data ficam na URL, e recarregar a página não perde a
          escolha. */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Select id="turma" name="turma" defaultValue={turma?.id ?? ""} required>
                <option value="" disabled>
                  Escolha a turma
                </option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                name="data"
                type="date"
                defaultValue={dia}
                max={hoje}
                required
                className="h-11 md:w-44"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="min-h-11 w-full">
                Abrir chamada
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!situacao.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{situacao.erro}</AlertDescription>
        </Alert>
      ) : null}

      {situacao.ok && situacao.retroativo && turma ? (
        <Alert role="status" className="border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertDescription className="text-inherit">
            Chamada retroativa: {formatarDiaBr(dia)}, não hoje ({formatarDiaBr(hoje)}).
            Confira a data antes de fechar.
          </AlertDescription>
        </Alert>
      ) : null}

      {chamada && turma ? (
        <>
          {chamada.lancamento ? (
            <Alert role="status">
              <AlertDescription>
                Chamada já fechada — você está editando. Lançada por{" "}
                {chamada.lancamento.porNome ?? "usuário desconhecido"} em{" "}
                {formatarMomentoBr(chamada.lancamento.em)}.
                {chamada.lancamento.alteracao
                  ? ` Última alteração por ${chamada.lancamento.alteracao.porNome ?? "usuário desconhecido"} em ${formatarMomentoBr(chamada.lancamento.alteracao.em)}.`
                  : ""}
              </AlertDescription>
            </Alert>
          ) : null}

          {chamada.emOutraTurma > 0 ? (
            <p className="text-muted-foreground text-sm">
              {chamada.emOutraTurma === 1
                ? "1 aluno desta turma já tem presença lançada em outra turma neste dia e não aparece aqui."
                : `${chamada.emOutraTurma} alunos desta turma já têm presença lançada em outra turma neste dia e não aparecem aqui.`}
            </p>
          ) : null}

          {chamada.alunos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum aluno ativo nesta turma.
            </p>
          ) : (
            // A key força a lista a recomeçar quando turma ou data mudam; sem
            // ela, as marcações de uma turma sobreviveriam na outra.
            <ListaChamada
              key={`${turma.id}:${dia}`}
              turmaId={turma.id}
              data={dia}
              fechada={chamada.lancamento !== null}
              limiar={chamada.limiar}
              alunos={chamada.alunos}
            />
          )}
        </>
      ) : null}
    </section>
  );
}
