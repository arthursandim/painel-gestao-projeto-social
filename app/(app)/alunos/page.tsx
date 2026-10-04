import { StatusAluno, type Prisma } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SeloDeAvisos, SeloDeFaltas } from "./avisos";
import { CabecalhoOrdenavel, SeletorOrdem } from "@/components/ordenacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exigirAcesso } from "@/lib/auth";
import { emRiscoDeEvasao } from "@/lib/chamada";
import { avisosDoAluno, type CodigoAviso } from "@/lib/avisosAluno";
import { dataParaDia, formatarDiaBr, hojeNoProjeto, idadeHoje } from "@/lib/data";
import { frequenciaDosAlunos, lerLimiarFaltas } from "@/lib/frequencia";
import { descreverGraduacao } from "@/lib/graduacao";
import { lerOrdem, ordenarPor, posicaoDaGraduacao } from "@/lib/ordenacao";
import { podeEscreverAluno } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { selectAlunoPara } from "@/lib/selecaoAluno";

export const metadata: Metadata = { title: "Alunos — Engenho Cidadão" };

// Colunas que ordenam, na ordem da tabela. "Última presença" só existe com o
// filtro de risco ligado.
const COLUNAS_ORDEM_ALUNO = [
  { campo: "matricula", rotulo: "Matrícula" },
  { campo: "nome", rotulo: "Nome" },
  { campo: "turma", rotulo: "Turma" },
  { campo: "nascimento", rotulo: "Nascimento" },
  { campo: "idade", rotulo: "Idade" },
  { campo: "graduacao", rotulo: "Graduação" },
  { campo: "situacao", rotulo: "Situação" },
  { campo: "ultimaPresenca", rotulo: "Última presença" },
] as const;
type CampoOrdemAluno = (typeof COLUNAS_ORDEM_ALUNO)[number]["campo"];
const CAMPOS_ORDEM_ALUNO = COLUNAS_ORDEM_ALUNO.map((c) => c.campo);

const FILTROS_STATUS = [
  { valor: "ATIVO", rotulo: "Ativos" },
  { valor: "DESLIGADO", rotulo: "Desligados" },
  { valor: "TODOS", rotulo: "Todos" },
] as const;

// Os avisos que o painel conta e para os quais o card leva. Os outros códigos
// continuam no selo de cada linha; aqui só os que viram alerta do painel.
const FILTROS_AVISO = [
  { valor: "TURMA", rotulo: "Troca de turma" },
  { valor: "ESCALA", rotulo: "Troca de escala" },
] as const satisfies readonly { valor: CodigoAviso; rotulo: string }[];

export default async function AlunosPage({ searchParams }: PageProps<"/alunos">) {
  const usuario = await exigirAcesso("/alunos");
  const filtros = await searchParams;

  const q = typeof filtros.q === "string" ? filtros.q.trim() : "";
  const turmaFiltro = typeof filtros.turma === "string" ? filtros.turma : "";
  const status =
    typeof filtros.status === "string" &&
    FILTROS_STATUS.some((f) => f.valor === filtros.status)
      ? filtros.status
      : "ATIVO";
  // Risco de evasão e os avisos do painel são sobre quem ocupa vaga: com um
  // desses filtros ligado, só ativos.
  const risco = filtros.risco === "1";
  const aviso = FILTROS_AVISO.find((f) => f.valor === filtros.aviso)?.valor ?? null;
  const soAtivos = risco || aviso !== null;

  const podeCadastrar = podeEscreverAluno(usuario.papeis);

  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      capacidade: true,
      _count: { select: { alunos: { where: { status: StatusAluno.ATIVO } } } },
    },
  });

  const where: Prisma.AlunoWhereInput = {
    ...(soAtivos
      ? { status: StatusAluno.ATIVO }
      : status === "TODOS"
        ? {}
        : { status: status as StatusAluno }),
    ...(turmaFiltro ? { turmaId: turmaFiltro } : {}),
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { matricula: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // O seletor único decide os campos. Nunca monte `select` à mão aqui: a tela
  // do professor precisa que a API devolva menos, não que o React esconda mais.
  const encontrados = await prisma.aluno.findMany({
    where,
    orderBy: { nome: "asc" },
    select: selectAlunoPara(usuario.papeis),
  });

  // Frequência só dos ativos: desligado não está em risco de evadir, já saiu.
  // Uma consulta de Presenca para todos, não uma por aluno.
  const [frequencia, limiar] = await Promise.all([
    frequenciaDosAlunos(
      encontrados.filter((a) => a.status === StatusAluno.ATIVO).map((a) => a.id),
    ),
    lerLimiarFaltas(),
  ]);
  const emRisco = (id: string) => {
    const f = frequencia.get(id);
    return f && emRiscoDeEvasao(f.faltas, limiar) ? f : null;
  };
  const hoje = hojeNoProjeto();
  const avisosPorAluno = new Map(
    encontrados.map((a) => [
      a.id,
      avisosDoAluno({ ...a, nascimento: dataParaDia(a.nascimento) }, hoje),
    ]),
  );

  const filtrados = encontrados.filter(
    (a) =>
      (!risco || emRisco(a.id)) &&
      (!aviso || avisosPorAluno.get(a.id)?.some((av) => av.codigo === aviso)),
  );

  // Ordenação por coluna, na URL. Faixa pela progressão da IBJJF, nunca pelo
  // alfabeto (lib/ordenacao.ts); empate desempata pelo nome.
  const ordem = lerOrdem(filtros, CAMPOS_ORDEM_ALUNO, { campo: "nome", dir: "asc" });
  const chaves: Record<CampoOrdemAluno, (a: (typeof filtrados)[number]) => string | number | null> = {
    matricula: (a) => a.matricula,
    nome: (a) => a.nome,
    turma: (a) => a.turma.nome,
    nascimento: (a) => dataParaDia(a.nascimento),
    idade: (a) => idadeHoje(a.nascimento, hoje),
    graduacao: (a) => posicaoDaGraduacao(a.graduacao, a.grau),
    // Ativo antes de desligado; entre os ativos, quem tem mais faltas seguidas.
    situacao: (a) => (a.status === StatusAluno.ATIVO ? 0 : 1000) - (emRisco(a.id)?.faltas ?? 0),
    ultimaPresenca: (a) => emRisco(a.id)?.ultimaPresenca ?? null,
  };
  const alunos = ordenarPor(filtrados, chaves[ordem.campo], ordem.dir, (a) => a.nome);
  const colunaOrdem = (rotulo: string, campo: CampoOrdemAluno) => (
    <CabecalhoOrdenavel rotulo={rotulo} campo={campo} ordem={ordem} caminho="/alunos" params={filtros} />
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-muted-foreground text-sm">
            {podeCadastrar
              ? "Cadastro, busca e edição. Nada é apagado: quem sai é desligado e a vaga fica livre."
              : "Consulta. Telefone, endereço, documentos e escola não aparecem nesta visão."}
          </p>
        </div>
        {podeCadastrar ? (
          <Button asChild className="min-h-11">
            <Link href="/alunos/novo">
              <Plus className="size-4" />
              Novo aluno
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Ocupação contra a capacidade configurada. A turma acima do limite
          aparece destacada — a exceção precisa ficar visível. */}
      <div className="flex flex-wrap gap-2">
        {turmas.map((turma) => {
          const ocupacao = turma._count.alunos;
          const acima = ocupacao > turma.capacidade;
          return (
            <Badge
              key={turma.id}
              variant={acima ? "destructive" : "secondary"}
              className="h-7"
            >
              {turma.nome}: {ocupacao}/{turma.capacidade}
              {acima ? " — acima da capacidade" : ""}
            </Badge>
          );
        })}
      </div>

      {/* Busca por GET: o filtro fica na URL, então o botão voltar do
          navegador funciona e o link pode ser guardado. Sem JavaScript. */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nome ou matrícula"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Select
                id="turma"
                name="turma"
                defaultValue={turmaFiltro}
                className="md:w-48"
              >
                <option value="">Todas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Situação</Label>
              <Select
                id="status"
                name="status"
                defaultValue={status}
                className="md:w-40"
              >
                {FILTROS_STATUS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aviso">Aviso</Label>
              <Select
                id="aviso"
                name="aviso"
                defaultValue={aviso ?? ""}
                className="lg:w-44"
              >
                <option value="">Qualquer</option>
                {FILTROS_AVISO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-end">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="risco"
                  value="1"
                  defaultChecked={risco}
                  className="size-5"
                />
                Só em risco de evasão
              </label>
            </div>

            <SeletorOrdem
              colunas={COLUNAS_ORDEM_ALUNO.filter((c) => risco || c.campo !== "ultimaPresenca")}
              ordem={ordem}
            />

            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="min-h-11 w-full">
                <Search className="size-4" />
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        {alunos.length === 0
          ? "Nenhum aluno com esses filtros."
          : `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}.`}
        {risco
          ? ` Ativos com ${limiar} ou mais faltas consecutivas — sequência, não soma. O limite é configurado em Parâmetros.`
          : ""}
        {aviso === "TURMA"
          ? " Ativos cuja idade não combina com a turma (corte dos 12 anos). Quem resolve é o campo Turma, no cadastro."
          : aviso === "ESCALA"
            ? " Ativos com 16 anos ou mais ainda com faixa da escala kids. Quem resolve é o campo Graduação, no cadastro."
            : ""}
      </p>

      {/* Abaixo de 768 px a tabela vira cartões empilhados — nunca rolagem
          horizontal. São as duas faces da mesma lista, não duas telas. */}
      <ul className="space-y-3 md:hidden">
        {alunos.map((aluno) => {
          const avisos = avisosPorAluno.get(aluno.id) ?? [];
          const faltas = emRisco(aluno.id);
          return (
            <li key={aluno.id}>
              <Link href={`/alunos/${aluno.id}`} className="block">
                <Card className="hover:bg-muted/40 transition-colors">
                  <CardContent className="space-y-1 pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{aluno.nome}</span>
                      <SeloDeAvisos quantidade={avisos.length} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {aluno.matricula} · {aluno.turma.nome} ·{" "}
                      {idadeHoje(aluno.nascimento, hoje)} anos
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {descreverGraduacao(aluno.graduacao, aluno.grau)}
                    </p>
                    {faltas ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <SeloDeFaltas {...faltas} />
                        <span className="text-muted-foreground text-xs">
                          {faltas.ultimaPresenca
                            ? `Última presença ${formatarDiaBr(faltas.ultimaPresenca)}`
                            : "Nenhuma presença registrada"}
                        </span>
                      </div>
                    ) : null}
                    {aluno.status === StatusAluno.DESLIGADO ? (
                      <Badge variant="outline">Desligado</Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        {alunos.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {colunaOrdem("Matrícula", "matricula")}
                  {colunaOrdem("Nome", "nome")}
                  {colunaOrdem("Turma", "turma")}
                  {colunaOrdem("Nascimento", "nascimento")}
                  {colunaOrdem("Idade", "idade")}
                  {colunaOrdem("Graduação", "graduacao")}
                  {colunaOrdem("Situação", "situacao")}
                  {risco ? colunaOrdem("Última presença", "ultimaPresenca") : null}
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const avisos = avisosPorAluno.get(aluno.id) ?? [];
                  const faltas = emRisco(aluno.id);
                  return (
                    <tr key={aluno.id} className="hover:bg-muted/40 border-t">
                      <td className="px-3 py-2 font-mono text-xs">
                        {aluno.matricula}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/alunos/${aluno.id}`}
                          className="flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                        >
                          {aluno.nome}
                          <SeloDeAvisos quantidade={avisos.length} />
                        </Link>
                      </td>
                      <td className="px-3 py-2">{aluno.turma.nome}</td>
                      <td className="px-3 py-2">
                        {formatarDiaBr(aluno.nascimento)}
                      </td>
                      <td className="px-3 py-2">
                        {idadeHoje(aluno.nascimento, hoje)}
                      </td>
                      <td className="px-3 py-2">
                        {descreverGraduacao(aluno.graduacao, aluno.grau)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {aluno.status === StatusAluno.ATIVO ? (
                            <Badge variant="secondary">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Desligado</Badge>
                          )}
                          {faltas ? <SeloDeFaltas {...faltas} /> : null}
                        </div>
                      </td>
                      {risco ? (
                        <td className="px-3 py-2">
                          {faltas?.ultimaPresenca
                            ? formatarDiaBr(faltas.ultimaPresenca)
                            : "Nenhuma"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
