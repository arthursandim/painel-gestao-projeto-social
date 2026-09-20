import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import "./ficha.css";
import { ControlesFicha } from "./controles";
import { PaginaCadastro, PaginaCessao, PaginaTermo, type DadosFicha } from "./paginas";
import { BotaoVoltar } from "@/components/botao-voltar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { exigirAcesso } from "@/lib/auth";
import { dataParaDia, formatarDiaBr, hojeNoProjeto, idadeHoje } from "@/lib/data";
import {
  podeImprimirFicha,
  ROTULO_VARIANTE,
  varianteDaFicha,
  VERSAO_FICHA,
} from "@/lib/ficha";
import { descreverGraduacao } from "@/lib/graduacao";
import { prisma } from "@/lib/prisma";
import { responsavelDoAluno } from "@/lib/responsavel";
import { ehAlunoCompleto, selectAlunoPara } from "@/lib/selecaoAluno";

export const metadata: Metadata = { title: "Ficha — Engenho Cidadão" };

/** Decimal do Prisma para o papel: 68.50 vira "68,5", 1.72 vira "1,72". */
function numeroBr(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "";
}

export default async function FichaPage({ params }: PageProps<"/alunos/[id]/ficha">) {
  const usuario = await exigirAcesso("/alunos");
  const { id } = await params;

  // A guarda da rota NÃO é a do módulo. `exigirAcesso("/alunos")` deixa o
  // professor entrar, porque ele consulta a turma — e a ficha imprime RG, CPF,
  // telefone, endereço, escola e série, que são exatamente as linhas "Não" da
  // tabela de visibilidade. Sem esta segunda guarda, o PDF entregaria o que o
  // seletor de campos recusa a entregar no JSON.
  if (!podeImprimirFicha(usuario.papeis)) forbidden();

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    select: selectAlunoPara(usuario.papeis),
  });
  if (!aluno) notFound();

  // Amarra o tipo ao mesmo predicado que decidiu a seleção: as duas checagens
  // derivam de `podeVerDadosSensiveis`, então não têm como divergir. Se um dia
  // divergirem, o certo é 403, não imprimir um campo em branco por acidente.
  if (!ehAlunoCompleto(aluno, usuario.papeis)) forbidden();

  const hoje = hojeNoProjeto();
  const nascimento = dataParaDia(aluno.nascimento);
  const variante = varianteDaFicha(nascimento, hoje);
  const idade = idadeHoje(nascimento, hoje);

  // Só para conferir na tela antes de gastar papel. O nome do responsável não
  // vai ao impresso — o modelo não tem campo para ele, só a linha de
  // assinatura. Derivado, nunca lido de `responsavelNome`: em PAI e MAE essa
  // coluna é nula e o nome mora em nomePai/nomeMae.
  const responsavel = responsavelDoAluno(aluno);

  const dados: DadosFicha = {
    variante,
    matricula: aluno.matricula,
    emitidaEm: formatarDiaBr(hoje),

    nome: aluno.nome,
    nascimento: formatarDiaBr(aluno.nascimento),
    naturalidade: aluno.naturalidade ?? "",
    nomePai: aluno.nomePai ?? "",
    nomeMae: aluno.nomeMae ?? "",

    endereco: aluno.endereco ?? "",
    numero: aluno.numero ?? "",
    bairro: aluno.bairro ?? "",
    cidade: aluno.cidade ?? "",
    estado: aluno.estado ?? "",
    cep: aluno.cep ?? "",
    telefone: aluno.telefoneResponsavel ?? "",

    rg: aluno.rg ?? "",
    rgOrgaoEmissor: aluno.rgOrgaoEmissor ?? "",
    rgUf: aluno.rgUf ?? "",
    rgDataEmissao: formatarDiaBr(aluno.rgDataEmissao),
    cpf: aluno.cpf ?? "",
    escola: aluno.escola ?? "",
    serie: aluno.serie ?? "",

    modalidade: "Jiu-Jitsu",
    graduacao: descreverGraduacao(aluno.graduacao, aluno.grau),
    graduacaoData: formatarDiaBr(aluno.graduacaoData),
    peso: numeroBr(aluno.peso),
    altura: numeroBr(aluno.altura),
  };

  return (
    <section className="space-y-6">
      <div className="space-y-4 print:hidden">
        <BotaoVoltar href={`/alunos/${aluno.id}`}>{aluno.nome}</BotaoVoltar>

        <div>
          <h1 className="text-2xl font-semibold">Ficha para impressão</h1>
          <p className="text-muted-foreground text-sm">
            {aluno.nome} · {aluno.matricula} · {idade} anos ·{" "}
            {ROTULO_VARIANTE[variante]} · template {VERSAO_FICHA}
          </p>
        </div>

        <Alert role="status">
          <AlertDescription>
            Sai a{" "}
            <strong>ficha de {variante === "MENOR" ? "menor" : "adulto"}</strong>,
            escolhida pela data de nascimento — não há troca manual.{" "}
            {variante === "MENOR"
              ? responsavel
                ? `Quem assina as três páginas é ${responsavel.nome} (${responsavel.parentesco}).`
                : "Nenhum responsável legal está definido no cadastro: as linhas de assinatura saem em branco."
              : "O aluno assina as três páginas."}{" "}
            Campo em branco no cadastro imprime como linha vazia, para ser
            preenchido à mão.
          </AlertDescription>
        </Alert>

        <ControlesFicha />
      </div>

      <div className="f-preview">
        <PaginaCadastro dados={dados} />
        <PaginaCessao dados={dados} />
        <PaginaTermo dados={dados} />
      </div>
    </section>
  );
}
