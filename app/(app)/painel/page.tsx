import { StatusAluno } from "@prisma/client";
import { ArrowRight, CalendarX, History, RefreshCw, Shirt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ItemChamada } from "../chamada/linha-chamada";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAcesso } from "@/lib/auth";
import { avisosDoAluno, type CodigoAviso } from "@/lib/avisosAluno";
import { emRiscoDeEvasao } from "@/lib/chamada";
import { dataParaDia, deslocarDia, formatarDiaBr, hojeNoProjeto, segundaDaSemana } from "@/lib/data";
import { frequenciaDosAlunos, lerLimiarFaltas } from "@/lib/frequencia";
import { ocupacaoDasTurmas } from "@/lib/ocupacao";
import { podeAcessar } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { resumoDasChamadas } from "@/lib/resumoChamadas";
import { selectAlunoPara } from "@/lib/selecaoAluno";
import { cn } from "cn";

export const metadata: Metadata = { title: "Painel de pendências — Engenho Cidadão" };

/**
 * Os três alertas desta fase, contados sobre os alunos ATIVOS. "Documento
 * pendente" e "Ficha a refazer" chegam com a fase 5.
 *
 * Troca de turma e troca de escala são os avisos TURMA e ESCALA do cadastro —
 * a mesma função, não um segundo cálculo dos cortes de 12 e 16 anos.
 */
async function contarAlertas(papeis: Parameters<typeof selectAlunoPara>[0], hoje: string) {
  // Toda leitura de Aluno passa pelo seletor único.
  const ativos = await prisma.aluno.findMany({
    where: { status: StatusAluno.ATIVO },
    select: selectAlunoPara(papeis),
  });

  const [frequencia, limiar] = await Promise.all([
    frequenciaDosAlunos(ativos.map((a) => a.id)),
    lerLimiarFaltas(),
  ]);

  const porCodigo: Record<Extract<CodigoAviso, "TURMA" | "ESCALA">, number> = {
    TURMA: 0,
    ESCALA: 0,
  };
  let risco = 0;
  for (const a of ativos) {
    if (emRiscoDeEvasao(frequencia.get(a.id)?.faltas ?? 0, limiar)) risco++;
    for (const aviso of avisosDoAluno({ ...a, nascimento: dataParaDia(a.nascimento) }, hoje)) {
      if (aviso.codigo === "TURMA" || aviso.codigo === "ESCALA") porCodigo[aviso.codigo]++;
    }
  }

  return { risco, limiar, turma: porCodigo.TURMA, escala: porCodigo.ESCALA };
}

function CardAlerta({
  href,
  titulo,
  regra,
  quantidade,
  icone: Icone,
}: {
  href: string;
  titulo: string;
  regra: string;
  quantidade: number;
  icone: React.ComponentType<{ className?: string }>;
}) {
  const ha = quantidade > 0;
  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          "hover:border-foreground/30 h-full transition-colors",
          ha && "border-destructive/50",
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icone className={cn("size-4", ha ? "text-destructive" : "text-muted-foreground")} />
                {titulo}
              </CardTitle>
              <CardDescription>{regra}</CardDescription>
            </div>
            <span
              className={cn(
                "text-3xl font-semibold tabular-nums",
                ha ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {quantidade}
            </span>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function PainelPage() {
  const usuario = await exigirAcesso("/painel");
  const hoje = hojeNoProjeto();

  // O painel alcança os quatro papéis, mas os alertas levam a /alunos e as
  // chamadas a /chamada, que INVENTARIO não abre. Card que leva a um 403 não
  // é card: quem não abre o destino não vê o bloco.
  const veAlunos = podeAcessar(usuario.papeis, "/alunos");
  const veChamada = podeAcessar(usuario.papeis, "/chamada");

  const segunda = segundaDaSemana(hoje);
  const domingo = deslocarDia(segunda, 6);

  const [alertas, ocupacao, turmas] = await Promise.all([
    veAlunos ? contarAlertas(usuario.papeis, hoje) : null,
    ocupacaoDasTurmas(),
    prisma.turma.findMany({ select: { id: true, nome: true } }),
  ]);
  const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]));
  const chamadas = veChamada
    ? await resumoDasChamadas({ de: segunda, ate: deslocarDia(domingo, 1), nomeTurma })
    : [];

  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Painel de pendências</h1>
        <p className="text-muted-foreground text-sm">
          Os alertas sinalizam; quem decide é você. Cada card leva à lista, e da
          lista ao cadastro — nada aqui desliga, troca de turma ou mexe em faixa.
        </p>
      </div>

      {alertas ? (
        <div className="grid gap-4 md:grid-cols-3">
          <CardAlerta
            href="/alunos?risco=1"
            titulo="Risco de evasão"
            regra={`${alertas.limiar} ou mais faltas consecutivas.`}
            quantidade={alertas.risco}
            icone={CalendarX}
          />
          <CardAlerta
            href="/alunos?aviso=TURMA"
            titulo="Troca de turma"
            regra="Idade não combina com a turma — Kids que completou 12 anos."
            quantidade={alertas.turma}
            icone={RefreshCw}
          />
          <CardAlerta
            href="/alunos?aviso=ESCALA"
            titulo="Troca de escala"
            regra="Completou 16 anos e continua com faixa da escala kids."
            quantidade={alertas.escala}
            icone={Shirt}
          />
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ocupação das turmas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ocupacao.map((t) => {
            const livres = t.capacidade - t.ativos;
            const pct = Math.min(100, Math.round((t.ativos / Math.max(t.capacidade, 1)) * 100));
            return (
              <Card key={t.id} className={cn(t.acima && "border-destructive/50")}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{t.nome}</span>
                    <span className="tabular-nums">
                      <span className="text-2xl font-semibold">{t.ativos}</span>
                      <span className="text-muted-foreground">/{t.capacidade}</span>
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", t.acima ? "bg-destructive" : "bg-foreground/70")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-sm">
                    {t.acima ? (
                      <Badge variant="destructive">
                        Acima da capacidade — {t.ativos - t.capacidade} além do limite
                      </Badge>
                    ) : livres === 0 ? (
                      <span className="text-muted-foreground">Cheia.</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {livres} {livres === 1 ? "vaga livre" : "vagas livres"}.
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {veChamada ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium">Chamadas da semana</h2>
              <p className="text-muted-foreground text-sm">
                {formatarDiaBr(segunda)} (seg) a {formatarDiaBr(domingo)} (dom). Toque
                numa linha para abrir e corrigir.
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/chamada/historico">
                <History className="size-4" />
                Histórico completo
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {chamadas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma chamada fechada nesta semana.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {chamadas.map((l) => (
                <ItemChamada
                  key={`${l.dia}|${l.turmaId}`}
                  linha={l}
                  nomeTurma={nomeTurma.get(l.turmaId)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  );
}
