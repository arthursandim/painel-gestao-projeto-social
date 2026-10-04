import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FormAtivoItem } from "./form-ativo";
import { FormEmprestar } from "./form-emprestar";
import { FormMovimento } from "./form-movimento";
import { ListaEmprestimos } from "../lista-emprestimos";
import { enviarFotoItem } from "../acoes";
import { BotaoVoltar } from "@/components/botao-voltar";
import { CapturaFoto } from "@/components/captura-foto";
import { QuadroFoto } from "@/components/quadro-foto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAcesso } from "@/lib/auth";
import { formatarDiaBr, formatarMomentoBr, hojeNoProjeto } from "@/lib/data";
import { abaixoDoMinimo, ROTULO_ESTADO, ROTULO_TIPO_MOVIMENTO } from "@/lib/estoque";
import { alunosParaEmprestar, contagemDoItem, emprestimosParaTela } from "@/lib/inventario";
import { ehAdmin } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { urlDaFoto } from "@/lib/storageFotos";

export const metadata: Metadata = { title: "Item — Engenho Cidadão" };

export default async function ItemPage({ params, searchParams }: PageProps<"/inventario/[id]">) {
  const usuario = await exigirAcesso("/inventario");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [item, contagem, emprestimos] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        descricao: true,
        categoria: true,
        observacao: true,
        unidadeMedida: true,
        quantidadeMinima: true,
        identificacao: true,
        estadoConservacao: true,
        podeSerEmprestado: true,
        ativo: true,
        fotoPath: true,
        criadoEm: true,
        atualizadoEm: true,
        criadoPor: { select: { nome: true } },
        atualizadoPor: { select: { nome: true } },
        // Mais recente primeiro: data do movimento, depois ordem de digitação.
        movimentos: {
          orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
          select: {
            id: true,
            tipo: true,
            quantidade: true,
            motivo: true,
            data: true,
            criadoEm: true,
            autor: { select: { nome: true } },
          },
        },
      },
    }),
    contagemDoItem(id),
    emprestimosParaTela({ itemId: id }),
  ]);
  if (!item) notFound();

  const baixo = abaixoDoMinimo(contagem.total, item.quantidadeMinima);
  const hoje = hojeNoProjeto();
  const urlFoto = await urlDaFoto(item.fotoPath);
  const podeEmprestar = item.ativo && item.podeSerEmprestado && contagem.disponivel > 0;
  // A lista de alunos só é lida quando o formulário aparece.
  const alunos = podeEmprestar ? await alunosParaEmprestar() : [];
  const un = item.unidadeMedida;

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/inventario">Inventário</BotaoVoltar>
        <div className="flex items-start gap-4">
          <QuadroFoto url={urlFoto} alt={`Foto de ${item.descricao}`} />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{item.descricao}</h1>
              {!item.ativo ? <Badge variant="outline">Inativo</Badge> : null}
              {item.podeSerEmprestado ? <Badge variant="secondary">Emprestável</Badge> : null}
              {baixo ? <Badge variant="destructive">Abaixo do mínimo</Badge> : null}
            </div>
            <p className="text-muted-foreground text-sm">
              {[item.categoria, item.identificacao].filter(Boolean).join(" · ") || "Sem categoria"}
            </p>
            <CapturaFoto id={item.id} acao={enviarFotoItem} temFoto={Boolean(item.fotoPath)} />
          </div>
        </div>
      </div>

      {(await searchParams).foto === "falhou" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            O item foi cadastrado, mas a foto não foi gravada. Envie de novo
            por “Tirar foto” ou “Escolher arquivo”.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Faixas permanentes enquanto a situação persistir: a exceção que o
          admin autorizou continua visível até alguém resolver. */}
      {contagem.emprestados > 0 && !item.ativo ? (
        <Alert>
          <AlertDescription>
            Item inativo com empréstimo em aberto. Registre a devolução ou a perda.
          </AlertDescription>
        </Alert>
      ) : null}
      {contagem.emprestados > 0 && !item.podeSerEmprestado ? (
        <Alert>
          <AlertDescription>
            Item marcado como não emprestável, mas com empréstimo em aberto.
            Registre a devolução ou a perda.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Numero rotulo="Total" valor={contagem.total} un={un} />
        <Numero rotulo="Disponível" valor={contagem.disponivel} un={un} />
        <Numero rotulo="Emprestado" valor={contagem.emprestados} un={un} />
      </div>
      <p className="text-muted-foreground text-xs">
        Total é a soma das entradas menos as saídas. Disponível é o total menos o
        que está emprestado. Nenhum dos dois se edita direto.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do item</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Campo rotulo="Estado de conservação" valor={ROTULO_ESTADO[item.estadoConservacao]} />
            <Campo rotulo="Unidade de medida" valor={un} />
            <Campo
              rotulo="Quantidade mínima"
              valor={item.quantidadeMinima > 0 ? `${item.quantidadeMinima} ${un}` : "Sem mínimo"}
            />
            <Campo rotulo="Pode ser emprestado" valor={item.podeSerEmprestado ? "Sim" : "Não"} />
            {item.observacao ? (
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Observação</dt>
                <dd className="whitespace-pre-line">{item.observacao}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-muted-foreground mt-4 text-xs">
            Cadastrado em {formatarMomentoBr(item.criadoEm)}
            {item.criadoPor ? ` por ${item.criadoPor.nome}` : ""}. Última alteração em{" "}
            {formatarMomentoBr(item.atualizadoEm)}
            {item.atualizadoPor ? ` por ${item.atualizadoPor.nome}` : ""}.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-start gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/inventario/${item.id}/editar`}>Editar dados</Link>
        </Button>
        {/* A chave reinicia a confirmação quando o estado muda. */}
        <FormAtivoItem
          key={String(item.ativo)}
          itemId={item.id}
          ativo={item.ativo}
          emprestados={contagem.emprestados}
          admin={ehAdmin(usuario.papeis)}
        />
      </div>

      {item.podeSerEmprestado || emprestimos.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Empréstimos</h2>
            <p className="text-muted-foreground text-sm">
              Emprestar não mexe no total: a unidade continua sendo do projeto, só
              deixa de estar disponível.
            </p>
          </div>
          {podeEmprestar ? (
            <FormEmprestar itemId={item.id} alunos={alunos} hojeIso={hoje} />
          ) : item.ativo && item.podeSerEmprestado ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma unidade disponível para emprestar.
            </p>
          ) : null}
          {emprestimos.length > 0 ? (
            <ListaEmprestimos emprestimos={emprestimos} hojeIso={hoje} />
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum empréstimo ainda.</p>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Movimentos de estoque</h2>
          <p className="text-muted-foreground text-sm">
            O total sai daqui. Correção de contagem também é um movimento, com motivo.
          </p>
        </div>

        {item.ativo ? (
          <FormMovimento
            itemId={item.id}
            disponivel={contagem.disponivel}
            unidade={un}
            hojeIso={hoje}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Item inativo não recebe movimento. Reative para lançar.
          </p>
        )}

        {/* Cartões abaixo de 768 px, tabela acima — mesma lista. */}
        <ul className="space-y-3 md:hidden">
          {item.movimentos.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="space-y-1 pt-6 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <SeloTipo tipo={m.tipo} />
                    <span className="font-medium tabular-nums">
                      {m.tipo === "ENTRADA" ? "+" : "−"}
                      {m.quantidade} {un}
                    </span>
                  </div>
                  <p>{m.motivo}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatarDiaBr(m.data)} · lançado em {formatarMomentoBr(m.criadoEm)}
                    {m.autor ? ` por ${m.autor.nome}` : ""}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Lançado por</th>
                </tr>
              </thead>
              <tbody>
                {item.movimentos.map((m) => (
                  <tr key={m.id} className="border-t align-top">
                    <td className="px-3 py-2">{formatarDiaBr(m.data)}</td>
                    <td className="px-3 py-2">
                      <SeloTipo tipo={m.tipo} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.tipo === "ENTRADA" ? "+" : "−"}
                      {m.quantidade}
                    </td>
                    <td className="px-3 py-2">{m.motivo}</td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {m.autor?.nome ?? "—"}
                      <br />
                      {formatarMomentoBr(m.criadoEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}

function SeloTipo({ tipo }: { tipo: keyof typeof ROTULO_TIPO_MOVIMENTO }) {
  return (
    <Badge variant={tipo === "ENTRADA" ? "secondary" : "outline"}>
      {ROTULO_TIPO_MOVIMENTO[tipo]}
    </Badge>
  );
}

function Numero({ rotulo, valor, un }: { rotulo: string; valor: number; un: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-muted-foreground text-xs">
          {rotulo} ({un})
        </p>
      </CardContent>
    </Card>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
