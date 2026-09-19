import { StatusAluno } from "@prisma/client";
import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ListaDeAvisos } from "../avisos";
import { FormStatusAluno } from "./form-status";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exigirAcesso } from "@/lib/auth";
import { avisosDoAluno } from "@/lib/avisosAluno";
import { dataParaDia, formatarDiaBr, hojeNoProjeto, idadeHoje } from "@/lib/data";
import { descreverGraduacao, ROTULO_ESCALA, escalaDaGraduacao } from "@/lib/graduacao";
import { podeEscreverAluno } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { responsavelDoAluno } from "@/lib/responsavel";
import { ehAlunoCompleto, selectAlunoPara } from "@/lib/selecaoAluno";

export const metadata: Metadata = { title: "Aluno — Engenho Cidadão" };

const VAZIO = "—";

function Dado({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className={valor ? "text-sm" : "text-muted-foreground text-sm"}>
        {valor || VAZIO}
      </dd>
    </div>
  );
}

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao ? <CardDescription>{descricao}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">{children}</dl>
      </CardContent>
    </Card>
  );
}

export default async function AlunoPage({
  params,
  searchParams,
}: PageProps<"/alunos/[id]">) {
  const usuario = await exigirAcesso("/alunos");
  const { id } = await params;
  const avisosDeRota = await searchParams;

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    select: selectAlunoPara(usuario.papeis),
  });
  if (!aluno) notFound();

  const hoje = hojeNoProjeto();
  const nascimentoIso = dataParaDia(aluno.nascimento);
  const idade = idadeHoje(nascimentoIso, hoje);

  const completo = ehAlunoCompleto(aluno, usuario.papeis) ? aluno : null;
  const podeEditar = podeEscreverAluno(usuario.papeis);

  const avisos = avisosDoAluno(
    {
      ...aluno,
      nascimento: nascimentoIso,
      autorizacaoAcimaPor: completo?.autorizacaoAcimaPor,
    },
    hoje,
  );

  const responsavel = completo ? responsavelDoAluno(completo) : null;

  // Indicador de completude: o que falta, em vez de obrigatoriedade no
  // formulário. É o desenho que o CLAUDE.md escolhe — cobrar depois, com o
  // cadastro já feito, em vez de bloquear na hora e não ter cadastro nenhum.
  const pendencias = completo
    ? (
        [
          ["Telefone do responsável", completo.telefoneResponsavel],
          ["Endereço", completo.endereco],
          ["RG", completo.rg],
          ["CPF", completo.cpf],
          ["Escola", completo.escola],
          ["Responsável legal", completo.responsavelTipo],
        ] as const
      )
        .filter(([, valor]) => !valor)
        .map(([rotulo]) => rotulo)
    : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col space-y-1">
        <BotaoVoltar href="/alunos">Alunos</BotaoVoltar>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{aluno.nome}</h1>
            <p className="text-muted-foreground font-mono text-sm">
              {aluno.matricula}
            </p>
          </div>
          {podeEditar ? (
            <Button asChild className="min-h-11">
              <Link href={`/alunos/${aluno.id}/editar`}>
                <Pencil className="size-4" />
                Editar
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {typeof avisosDeRota.novo === "string" ? (
        <Alert role="status">
          <AlertDescription>
            Aluno cadastrado com a matrícula {avisosDeRota.novo}.
          </AlertDescription>
        </Alert>
      ) : null}
      {avisosDeRota.salvo ? (
        <Alert role="status">
          <AlertDescription>Alterações salvas.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant={aluno.status === StatusAluno.ATIVO ? "default" : "outline"}>
          {aluno.status === StatusAluno.ATIVO ? "Ativo" : "Desligado"}
        </Badge>
        <Badge variant="secondary">{aluno.turma.nome}</Badge>
        <Badge variant="secondary">
          {descreverGraduacao(aluno.graduacao, aluno.grau)}
        </Badge>
        <Badge variant="outline">
          Escala {ROTULO_ESCALA[escalaDaGraduacao(aluno.graduacao)]}
        </Badge>
      </div>

      <ListaDeAvisos avisos={avisos} />

      <Bloco titulo="Identificação">
        <Dado rotulo="Nascimento" valor={formatarDiaBr(aluno.nascimento)} />
        <Dado rotulo="Idade" valor={`${idade} anos`} />
        <Dado rotulo="Sexo" valor={aluno.sexo === "M" ? "Masculino" : "Feminino"} />
        <Dado rotulo="Modalidade" valor="Jiu-Jitsu" />
        <Dado
          rotulo="Data da graduação"
          valor={formatarDiaBr(aluno.graduacaoData)}
        />
        {completo ? (
          <Dado rotulo="Naturalidade" valor={completo.naturalidade} />
        ) : null}
        <Dado rotulo="Peso" valor={aluno.peso ? `${aluno.peso} kg` : null} />
        <Dado rotulo="Altura" valor={aluno.altura ? `${aluno.altura} m` : null} />
      </Bloco>

      <Bloco
        titulo="Família e responsável legal"
        descricao={
          completo
            ? "O nome do responsável é lido do campo do pai ou da mãe, não copiado — corrigir um corrige o outro."
            : undefined
        }
      >
        <Dado rotulo="Nome do pai" valor={aluno.nomePai} />
        <Dado rotulo="Nome da mãe" valor={aluno.nomeMae} />
        {completo ? (
          <Dado
            rotulo="Responsável legal"
            valor={
              responsavel
                ? `${responsavel.nome} (${responsavel.parentesco})`
                : null
            }
          />
        ) : null}
      </Bloco>

      {completo ? (
        <>
          <Bloco titulo="Contato">
            <Dado
              rotulo="Telefone do responsável"
              valor={completo.telefoneResponsavel}
            />
            <Dado rotulo="Telefone do aluno" valor={completo.telefoneAluno} />
            <Dado rotulo="E-mail" valor={completo.email} />
          </Bloco>

          <Bloco titulo="Endereço">
            <Dado
              rotulo="Logradouro"
              valor={
                completo.endereco
                  ? `${completo.endereco}${completo.numero ? `, ${completo.numero}` : ""}`
                  : null
              }
            />
            <Dado rotulo="Bairro" valor={completo.bairro} />
            <Dado
              rotulo="Cidade"
              valor={
                completo.cidade
                  ? `${completo.cidade}${completo.estado ? ` — ${completo.estado}` : ""}`
                  : null
              }
            />
            <Dado rotulo="CEP" valor={completo.cep} />
          </Bloco>

          <Bloco titulo="Documentos pessoais">
            <Dado
              rotulo="RG"
              valor={
                completo.rg
                  ? [completo.rg, completo.rgOrgaoEmissor, completo.rgUf]
                      .filter(Boolean)
                      .join(" ")
                  : null
              }
            />
            <Dado
              rotulo="Emissão do RG"
              valor={formatarDiaBr(completo.rgDataEmissao)}
            />
            <Dado rotulo="CPF" valor={completo.cpf} />
          </Bloco>

          <Bloco titulo="Escola">
            <Dado rotulo="Escola" valor={completo.escola} />
            <Dado rotulo="Série" valor={completo.serie} />
          </Bloco>

          {pendencias.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Completude do cadastro
                </CardTitle>
                <CardDescription>
                  Nenhum destes campos é obrigatório para cadastrar. A lista
                  existe para eles não ficarem esquecidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {pendencias.map((p) => (
                    <li key={p}>
                      <Badge variant="outline">{p}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situação e histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <Dado
                  rotulo="Cadastrado por"
                  valor={
                    completo.criadoPor
                      ? `${completo.criadoPor.nome} em ${formatarDiaBr(completo.criadoEm)}`
                      : formatarDiaBr(completo.criadoEm)
                  }
                />
                <Dado
                  rotulo="Última alteração"
                  valor={
                    completo.atualizadoPor
                      ? `${completo.atualizadoPor.nome} em ${formatarDiaBr(completo.atualizadoEm)}`
                      : formatarDiaBr(completo.atualizadoEm)
                  }
                />
                {completo.status === StatusAluno.DESLIGADO ? (
                  <Dado
                    rotulo="Desligamento"
                    valor={
                      completo.desligadoEm
                        ? `${formatarDiaBr(completo.desligadoEm)}${completo.desligadoPor ? ` por ${completo.desligadoPor.nome}` : ""} — ${completo.desligadoMotivo ?? ""}`
                        : null
                    }
                  />
                ) : null}
              </dl>

              {podeEditar ? (
                <FormStatusAluno
                  alunoId={aluno.id}
                  ativo={aluno.status === StatusAluno.ATIVO}
                  nome={aluno.nome}
                />
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert>
          <AlertDescription>
            Telefone, endereço, RG, CPF, escola e documentos digitalizados não
            aparecem na visão de professor. Quem precisa deles fala com
            inscrições.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
