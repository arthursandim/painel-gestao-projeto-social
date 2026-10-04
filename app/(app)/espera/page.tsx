import { StatusListaEspera } from "@prisma/client";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormRemoverEspera } from "./form-remover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataParaDia, formatarDiaBr, formatarMomentoBr, hojeNoProjeto, idadeEm } from "@/lib/data";
import { ordemDaFila } from "@/lib/esquemaEspera";
import { ocupacaoDasTurmas } from "@/lib/ocupacao";
import { prisma } from "@/lib/prisma";
import { idadeCombinaComTurma } from "@/lib/turma";

export const metadata: Metadata = { title: "Lista de espera — Engenho Cidadão" };

const ABAS = [
  { valor: StatusListaEspera.AGUARDANDO, rotulo: "Aguardando" },
  { valor: StatusListaEspera.CONVERTIDO, rotulo: "Convertidos" },
  { valor: StatusListaEspera.REMOVIDO, rotulo: "Removidos" },
] as const;

function diasDesde(diaIso: string, hojeIso: string): number {
  return Math.round(
    (Date.parse(`${hojeIso}T00:00:00Z`) - Date.parse(`${diaIso}T00:00:00Z`)) / 86_400_000,
  );
}

export default async function EsperaPage({ searchParams }: PageProps<"/espera">) {
  // O layout de /espera já barrou quem não é ADMIN nem INSCRICOES.
  const params = await searchParams;
  const aba =
    ABAS.find((a) => a.valor === params.status)?.valor ?? StatusListaEspera.AGUARDANDO;
  const hoje = hojeNoProjeto();

  const contagem = await prisma.listaEspera.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const total = new Map(contagem.map((c) => [c.status, c._count._all]));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lista de espera</h1>
          <p className="text-muted-foreground text-sm">
            Fila por turma, na ordem de entrada. Quando abrir vaga, converta em
            aluno: o cadastro completo abre já preenchido.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/espera/nova">
            <Plus className="size-4" />
            Incluir na fila
          </Link>
        </Button>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Situação">
        {ABAS.map((a) => (
          <Button
            key={a.valor}
            asChild
            variant={a.valor === aba ? "secondary" : "ghost"}
            className="min-h-11"
          >
            <Link
              href={a.valor === StatusListaEspera.AGUARDANDO ? "/espera" : `/espera?status=${a.valor}`}
              aria-current={a.valor === aba ? "page" : undefined}
            >
              {a.rotulo} ({total.get(a.valor) ?? 0})
            </Link>
          </Button>
        ))}
      </nav>

      {aba === StatusListaEspera.AGUARDANDO ? (
        <Aguardando hoje={hoje} />
      ) : aba === StatusListaEspera.CONVERTIDO ? (
        <Convertidos />
      ) : (
        <Removidos />
      )}
    </section>
  );
}

async function Aguardando({ hoje }: { hoje: string }) {
  const [registros, ocupacao] = await Promise.all([
    prisma.listaEspera.findMany({
      where: { status: StatusListaEspera.AGUARDANDO },
      select: {
        id: true,
        nome: true,
        nascimento: true,
        telefone: true,
        dataEntrada: true,
        observacao: true,
        criadoEm: true,
        turmaPretendida: { select: { id: true, codigo: true, nome: true } },
      },
    }),
    ocupacaoDasTurmas(),
  ]);

  const fila = registros
    .map((r) => ({
      ...r,
      turmaNome: r.turmaPretendida?.nome ?? "Sem turma definida",
      dataEntrada: dataParaDia(r.dataEntrada),
      nascimento: dataParaDia(r.nascimento),
    }))
    .sort(ordemDaFila);

  if (fila.length === 0) {
    return <p className="text-muted-foreground text-sm">Ninguém aguardando.</p>;
  }

  const grupos = new Map<string, typeof fila>();
  for (const r of fila) {
    const chave = r.turmaPretendida?.id ?? "";
    grupos.set(chave, [...(grupos.get(chave) ?? []), r]);
  }

  return (
    <div className="space-y-8">
      {[...grupos.entries()].map(([turmaId, pessoas]) => {
        const turma = ocupacao.find((t) => t.id === turmaId);
        const livres = turma ? turma.capacidade - turma.ativos : null;
        return (
          <section key={turmaId} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{pessoas[0].turmaNome}</h2>
              <span className="text-muted-foreground text-sm">
                {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
              </span>
              {turma ? (
                <Badge variant={livres !== null && livres <= 0 ? "destructive" : "secondary"}>
                  {turma.ativos}/{turma.capacidade}
                  {livres !== null && livres > 0
                    ? ` — ${livres} ${livres === 1 ? "vaga livre" : "vagas livres"}`
                    : turma.acima
                      ? " — acima da capacidade"
                      : " — cheia"}
                </Badge>
              ) : null}
            </div>

            <ol className="space-y-3">
              {pessoas.map((p, i) => {
                const idade = idadeEm(p.nascimento, hoje);
                const combina =
                  !p.turmaPretendida || idadeCombinaComTurma(idade, p.turmaPretendida.codigo);
                const dias = diasDesde(p.dataEntrada, hoje);
                return (
                  <li key={p.id}>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-baseline gap-2 text-base">
                          <span className="text-muted-foreground font-mono text-sm">
                            {i + 1}º
                          </span>
                          {p.nome}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          {idade} anos ({formatarDiaBr(p.nascimento)})
                          {p.telefone ? ` · ${p.telefone}` : " · sem telefone"}
                        </p>
                        <p className="text-muted-foreground">
                          Na fila desde {formatarDiaBr(p.dataEntrada)}
                          {dias > 0 ? ` — ${dias} ${dias === 1 ? "dia" : "dias"}` : " — hoje"}
                        </p>
                        {!combina ? (
                          <p className="text-amber-700 dark:text-amber-400">
                            Com {idade} anos a idade não combina com a turma pretendida.
                            Confira ao converter.
                          </p>
                        ) : null}
                        {p.observacao ? <p className="whitespace-pre-line">{p.observacao}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <Button asChild className="min-h-11">
                            <Link href={`/alunos/novo?espera=${p.id}`}>Converter em aluno</Link>
                          </Button>
                          <Button asChild variant="outline" className="min-h-11">
                            <Link href={`/espera/${p.id}/editar`}>Editar</Link>
                          </Button>
                          <FormRemoverEspera id={p.id} nome={p.nome} />
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

async function Convertidos() {
  const registros = await prisma.listaEspera.findMany({
    where: { status: StatusListaEspera.CONVERTIDO },
    orderBy: { convertidoEm: "desc" },
    select: {
      id: true,
      nome: true,
      dataEntrada: true,
      convertidoEm: true,
      convertidoPor: { select: { nome: true } },
      turmaPretendida: { select: { nome: true } },
      aluno: { select: { id: true, matricula: true } },
    },
  });

  if (registros.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma conversão ainda.</p>;
  }

  return (
    <ul className="space-y-3">
      {registros.map((r) => (
        <li key={r.id}>
          <Card>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium">{r.nome}</p>
              <p className="text-muted-foreground">
                {r.turmaPretendida?.nome ?? "Sem turma"} · na fila desde{" "}
                {formatarDiaBr(r.dataEntrada)}
              </p>
              <p className="text-muted-foreground">
                Convertido
                {r.convertidoEm ? ` em ${formatarMomentoBr(r.convertidoEm)}` : ""}
                {r.convertidoPor ? ` por ${r.convertidoPor.nome}` : ""}
              </p>
              {r.aluno ? (
                <Link
                  href={`/alunos/${r.aluno.id}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  Abrir cadastro {r.aluno.matricula}
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function Removidos() {
  const registros = await prisma.listaEspera.findMany({
    where: { status: StatusListaEspera.REMOVIDO },
    orderBy: { removidoEm: "desc" },
    select: {
      id: true,
      nome: true,
      telefone: true,
      dataEntrada: true,
      removidoEm: true,
      motivoRemocao: true,
      removidoPor: { select: { nome: true } },
      turmaPretendida: { select: { nome: true } },
    },
  });

  if (registros.length === 0) {
    return <p className="text-muted-foreground text-sm">Ninguém removido.</p>;
  }

  return (
    <ul className="space-y-3">
      {registros.map((r) => (
        <li key={r.id}>
          <Card>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium">{r.nome}</p>
              <p className="text-muted-foreground">
                {r.turmaPretendida?.nome ?? "Sem turma"} · na fila desde{" "}
                {formatarDiaBr(r.dataEntrada)}
                {r.telefone ? ` · ${r.telefone}` : ""}
              </p>
              <p className="text-muted-foreground">
                Removido
                {r.removidoEm ? ` em ${formatarMomentoBr(r.removidoEm)}` : ""}
                {r.removidoPor ? ` por ${r.removidoPor.nome}` : ""}
              </p>
              {r.motivoRemocao ? <p>Motivo: {r.motivoRemocao}</p> : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
