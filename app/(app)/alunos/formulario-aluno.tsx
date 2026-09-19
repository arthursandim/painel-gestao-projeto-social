"use client";

import { Graduacao, Modalidade, ResponsavelTipo, Sexo } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { EstadoAluno } from "./acoes";
import { avisosDoAluno } from "@/lib/avisosAluno";
import { ehDiaValido, idadeEm } from "@/lib/data";
import { CAMPOS_ALUNO, OPCOES_UF } from "@/lib/esquemaAluno";
import {
  DESCRICAO_ESCALA,
  escalaDaGraduacao,
  escalaPorIdade,
  GRADUACOES_POR_ESCALA,
  GRAU_MAXIMO,
  GRAU_MINIMO,
  ROTULO_ESCALA,
  ROTULO_GRADUACAO,
} from "@/lib/graduacao";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type TurmaOpcao = {
  id: string;
  codigo: string;
  nome: string;
  capacidade: number;
  ocupacao: number;
};

export type ValoresAluno = Record<(typeof CAMPOS_ALUNO)[number], string>;

export const VALORES_VAZIOS: ValoresAluno = Object.fromEntries(
  CAMPOS_ALUNO.map((campo) => [campo, ""]),
) as ValoresAluno;

const ROTULO_SEXO: Record<Sexo, string> = { M: "Masculino", F: "Feminino" };
const ROTULO_MODALIDADE: Record<Modalidade, string> = { JIU_JITSU: "Jiu-Jitsu" };

function Secao({
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
      {/* Uma coluna abaixo de 768 px, sempre. Nunca rolagem horizontal. */}
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function Campo({
  nome,
  rotulo,
  dica,
  largo,
  children,
}: {
  nome: string;
  rotulo: string;
  dica?: string;
  largo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${largo ? "md:col-span-2" : ""}`}>
      <Label htmlFor={nome}>{rotulo}</Label>
      {children}
      {dica ? <p className="text-muted-foreground text-xs">{dica}</p> : null}
    </div>
  );
}

function Enviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Salvando…" : children}
    </Button>
  );
}

export function FormularioAluno({
  acao,
  turmas,
  valores,
  alunoId,
  hojeIso,
  podeAutorizarCapacidade,
  hrefCancelar,
  rotuloSalvar,
}: {
  acao: (estado: EstadoAluno, form: FormData) => Promise<EstadoAluno>;
  turmas: readonly TurmaOpcao[];
  valores: ValoresAluno;
  alunoId?: string;
  /** "Hoje" vem do servidor: calculado no cliente, a idade divergiria na
   *  hidratação sempre que o navegador estivesse em outro fuso. */
  hojeIso: string;
  podeAutorizarCapacidade: boolean;
  hrefCancelar: string;
  rotuloSalvar: string;
}) {
  const [estado, enviar] = useActionState<EstadoAluno, FormData>(acao, {});

  const [nascimento, setNascimento] = useState(valores.nascimento);
  const [graduacao, setGraduacao] = useState(valores.graduacao);
  const [turmaId, setTurmaId] = useState(valores.turmaId || turmas[0]?.id || "");
  const [avisoEscala, setAvisoEscala] = useState("");

  const [ehResponsavel, setEhResponsavel] = useState<"" | "PAI" | "MAE">(
    valores.responsavelTipo === ResponsavelTipo.PAI
      ? "PAI"
      : valores.responsavelTipo === ResponsavelTipo.MAE
        ? "MAE"
        : "",
  );
  const [nomePai, setNomePai] = useState(valores.nomePai);
  const [nomeMae, setNomeMae] = useState(valores.nomeMae);
  const [responsavelNome, setResponsavelNome] = useState(valores.responsavelNome);

  const nascimentoValido = ehDiaValido(nascimento);
  const idade = nascimentoValido ? idadeEm(nascimento, hojeIso) : null;
  const escala = idade === null ? null : escalaPorIdade(idade);

  /**
   * A faixa que já estava gravada e não existe mais na escala de hoje.
   *
   * Fica na lista como um grupo à parte para que uma edição de telefone possa
   * ser salva sem obrigar ninguém a graduar o aluno de improviso. O aviso
   * permanente é que pede o reposicionamento — o formulário não o força.
   */
  const faixaHerdada = useMemo(() => {
    const gravada = valores.graduacao as Graduacao | "";
    if (!gravada || !escala) return null;
    return escalaDaGraduacao(gravada) === escala ? null : gravada;
  }, [valores.graduacao, escala]);

  function aoMudarNascimento(novo: string) {
    setNascimento(novo);
    if (!graduacao || !ehDiaValido(novo)) return;

    const novaEscala = escalaPorIdade(idadeEm(novo, hojeIso));
    if (escalaDaGraduacao(graduacao as Graduacao) === novaEscala) {
      setAvisoEscala("");
      return;
    }
    // A correção da data cruzou os 16 anos e a faixa escolhida não existe na
    // nova escala: limpa o campo e avisa, como manda o CLAUDE.md.
    setGraduacao("");
    setAvisoEscala(
      `A data de nascimento passou o aluno para a escala ${ROTULO_ESCALA[novaEscala]}. A faixa escolhida não existe nela, então o campo Graduação foi limpo — escolha de novo.`,
    );
  }

  const turma = turmas.find((t) => t.id === turmaId);
  const mudouDeTurma = turmaId !== valores.turmaId;
  const turmaLotada = Boolean(
    turma && mudouDeTurma && turma.ocupacao >= turma.capacidade,
  );

  const responsavelTipo: ResponsavelTipo | "" =
    ehResponsavel === "PAI"
      ? ResponsavelTipo.PAI
      : ehResponsavel === "MAE"
        ? ResponsavelTipo.MAE
        : responsavelNome.trim()
          ? ResponsavelTipo.OUTRO
          : "";

  const avisos =
    nascimentoValido && graduacao && turma
      ? avisosDoAluno(
          {
            nascimento,
            graduacao: graduacao as Graduacao,
            turma: { codigo: turma.codigo, nome: turma.nome },
            responsavelTipo: responsavelTipo || null,
          },
          hojeIso,
        )
      : [];

  return (
    <form action={enviar} className="space-y-6">
      {alunoId ? <input type="hidden" name="id" value={alunoId} /> : null}
      <input type="hidden" name="responsavelTipo" value={responsavelTipo} />
      <input
        type="hidden"
        name="duplicidadeConfirmadaPara"
        value={estado.duplicidade?.nome ?? ""}
      />

      {/* ------------------------------------------------ identificação */}
      <Secao
        titulo="Identificação"
        descricao="Obrigatórios: nome, nascimento, turma, modalidade, graduação e sexo. O resto pode ficar em branco e ser completado depois."
      >
        <Campo nome="nome" rotulo="Nome completo" largo>
          <Input
            id="nome"
            name="nome"
            defaultValue={valores.nome}
            required
            minLength={3}
            autoComplete="off"
            className="h-11"
          />
        </Campo>

        <Campo
          nome="nascimento"
          rotulo="Data de nascimento"
          dica={
            idade === null
              ? "É ela que decide a escala da graduação e a turma."
              : `${idade} anos hoje.`
          }
        >
          <Input
            id="nascimento"
            name="nascimento"
            type="date"
            value={nascimento}
            max={hojeIso}
            onChange={(e) => aoMudarNascimento(e.target.value)}
            required
            className="h-11"
          />
        </Campo>

        <Campo nome="sexo" rotulo="Sexo" dica="Só no digital — não vai na ficha impressa.">
          <Select id="sexo" name="sexo" defaultValue={valores.sexo} required>
            <option value="">Escolha…</option>
            {Object.values(Sexo).map((s) => (
              <option key={s} value={s}>
                {ROTULO_SEXO[s]}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo nome="naturalidade" rotulo="Naturalidade">
          <Input
            id="naturalidade"
            name="naturalidade"
            defaultValue={valores.naturalidade}
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* --------------------------------------------- turma e graduação */}
      <Secao
        titulo="Turma e graduação"
        descricao="São duas réguas diferentes: a turma vira Jovens/Adultos aos 12 anos, e a escala da faixa vira adulta aos 16. Entre 12 e 15 o aluno treina em Jovens/Adultos com faixa kids, e isso é normal."
      >
        <Campo
          nome="turmaId"
          rotulo="Turma"
          dica={
            turma
              ? `${turma.ocupacao} de ${turma.capacidade} vagas ocupadas.`
              : undefined
          }
        >
          <Select
            id="turmaId"
            name="turmaId"
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            required
          >
            <option value="">Escolha…</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} — {t.ocupacao}/{t.capacidade}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo nome="modalidade" rotulo="Modalidade">
          <Select
            id="modalidade"
            name="modalidade"
            defaultValue={valores.modalidade || Modalidade.JIU_JITSU}
            required
          >
            {Object.values(Modalidade).map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODALIDADE[m]}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo
          nome="graduacao"
          rotulo="Graduação"
          dica={
            escala
              ? `A idade define a escala: ${DESCRICAO_ESCALA[escala]}. A outra escala não fica disponível.`
              : "Informe a data de nascimento para a lista de faixas aparecer."
          }
        >
          <Select
            id="graduacao"
            name="graduacao"
            value={graduacao}
            onChange={(e) => {
              setGraduacao(e.target.value);
              setAvisoEscala("");
            }}
            disabled={!escala}
            required
          >
            <option value="">Escolha…</option>
            {escala ? (
              <optgroup label={DESCRICAO_ESCALA[escala]}>
                {GRADUACOES_POR_ESCALA[escala].map((g) => (
                  <option key={g} value={g}>
                    {ROTULO_GRADUACAO[g]}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {faixaHerdada ? (
              <optgroup
                label={`Faixa atual — escala ${ROTULO_ESCALA[escalaDaGraduacao(faixaHerdada)]}, a reposicionar`}
              >
                <option value={faixaHerdada}>
                  {ROTULO_GRADUACAO[faixaHerdada]}
                </option>
              </optgroup>
            ) : null}
          </Select>
        </Campo>

        <Campo nome="grau" rotulo="Grau">
          <Select id="grau" name="grau" defaultValue={valores.grau || "0"} required>
            {Array.from({ length: GRAU_MAXIMO - GRAU_MINIMO + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "Sem grau" : `${i}º grau`}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo nome="graduacaoData" rotulo="Data da graduação">
          <Input
            id="graduacaoData"
            name="graduacaoData"
            type="date"
            defaultValue={valores.graduacaoData}
            max={hojeIso}
            className="h-11"
          />
        </Campo>

        {avisoEscala ? (
          <div className="md:col-span-2">
            <Alert role="status">
              <AlertTitle>A escala mudou</AlertTitle>
              <AlertDescription>{avisoEscala}</AlertDescription>
            </Alert>
          </div>
        ) : null}
      </Secao>

      {/* --------------------------------------- família e responsável */}
      <Secao
        titulo="Família e responsável legal"
        descricao="Marcar o pai ou a mãe como responsável guarda apenas a referência: o nome é lido do campo correspondente, então corrigir o nome ali corrige o responsável junto."
      >
        <Campo nome="nomePai" rotulo="Nome do pai">
          <Input
            id="nomePai"
            name="nomePai"
            value={nomePai}
            onChange={(e) => setNomePai(e.target.value)}
            className="h-11"
          />
          <label className="hover:bg-muted/50 mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md p-2">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={ehResponsavel === "PAI"}
              disabled={!nomePai.trim()}
              onChange={(e) => setEhResponsavel(e.target.checked ? "PAI" : "")}
            />
            <span className="text-sm">É o responsável legal</span>
          </label>
        </Campo>

        <Campo nome="nomeMae" rotulo="Nome da mãe">
          <Input
            id="nomeMae"
            name="nomeMae"
            value={nomeMae}
            onChange={(e) => setNomeMae(e.target.value)}
            className="h-11"
          />
          <label className="hover:bg-muted/50 mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md p-2">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={ehResponsavel === "MAE"}
              disabled={!nomeMae.trim()}
              onChange={(e) => setEhResponsavel(e.target.checked ? "MAE" : "")}
            />
            <span className="text-sm">É o responsável legal</span>
          </label>
        </Campo>

        <Campo
          nome="responsavelNome"
          rotulo="Outro responsável legal"
          dica={
            ehResponsavel
              ? `Bloqueado porque o responsável é ${ehResponsavel === "PAI" ? "o pai" : "a mãe"}. Desmarque acima para usar outra pessoa.`
              : "Para avó, tio, guardião — quem não é o pai nem a mãe."
          }
        >
          <Input
            id="responsavelNome"
            name="responsavelNome"
            value={ehResponsavel ? "" : responsavelNome}
            onChange={(e) => setResponsavelNome(e.target.value)}
            disabled={Boolean(ehResponsavel)}
            className="h-11"
          />
        </Campo>

        <Campo nome="responsavelParentesco" rotulo="Parentesco">
          <Input
            id="responsavelParentesco"
            name="responsavelParentesco"
            defaultValue={valores.responsavelParentesco}
            disabled={Boolean(ehResponsavel)}
            placeholder="Avó, tio, guardião…"
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* ------------------------------------------------------ contato */}
      <Secao titulo="Contato">
        <Campo nome="telefoneResponsavel" rotulo="Telefone do responsável" dica="Com DDD.">
          <Input
            id="telefoneResponsavel"
            name="telefoneResponsavel"
            type="tel"
            inputMode="tel"
            defaultValue={valores.telefoneResponsavel}
            placeholder="(96) 99123-4567"
            className="h-11"
          />
        </Campo>

        <Campo
          nome="telefoneAluno"
          rotulo="Telefone do aluno"
          dica="Só no digital — não vai na ficha impressa."
        >
          <Input
            id="telefoneAluno"
            name="telefoneAluno"
            type="tel"
            inputMode="tel"
            defaultValue={valores.telefoneAluno}
            className="h-11"
          />
        </Campo>

        <Campo
          nome="email"
          rotulo="E-mail"
          dica="Só no digital — não vai na ficha impressa."
          largo
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoCapitalize="none"
            defaultValue={valores.email}
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* ----------------------------------------------------- endereço */}
      <Secao titulo="Endereço">
        <Campo nome="endereco" rotulo="Logradouro" largo>
          <Input
            id="endereco"
            name="endereco"
            defaultValue={valores.endereco}
            className="h-11"
          />
        </Campo>
        <Campo nome="numero" rotulo="Número">
          <Input
            id="numero"
            name="numero"
            defaultValue={valores.numero}
            className="h-11"
          />
        </Campo>
        <Campo nome="bairro" rotulo="Bairro">
          <Input
            id="bairro"
            name="bairro"
            defaultValue={valores.bairro}
            className="h-11"
          />
        </Campo>
        <Campo nome="cidade" rotulo="Cidade">
          <Input
            id="cidade"
            name="cidade"
            defaultValue={valores.cidade}
            className="h-11"
          />
        </Campo>
        <Campo nome="estado" rotulo="Estado">
          <Select id="estado" name="estado" defaultValue={valores.estado}>
            <option value="">—</option>
            {OPCOES_UF.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo nome="cep" rotulo="CEP" dica="Formato 00000-000.">
          <Input
            id="cep"
            name="cep"
            inputMode="numeric"
            defaultValue={valores.cep}
            placeholder="68900-000"
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* ---------------------------------------------------- documentos */}
      <Secao
        titulo="Documentos pessoais"
        descricao="Opcionais de propósito: boa parte das crianças chega sem documento em mãos, e formulário rígido produz cadastro não feito ou dado inventado."
      >
        <Campo nome="rg" rotulo="RG">
          <Input id="rg" name="rg" defaultValue={valores.rg} className="h-11" />
        </Campo>
        <Campo nome="rgOrgaoEmissor" rotulo="Órgão emissor">
          <Input
            id="rgOrgaoEmissor"
            name="rgOrgaoEmissor"
            defaultValue={valores.rgOrgaoEmissor}
            placeholder="SSP"
            className="h-11"
          />
        </Campo>
        <Campo nome="rgUf" rotulo="UF do RG">
          <Select id="rgUf" name="rgUf" defaultValue={valores.rgUf}>
            <option value="">—</option>
            {OPCOES_UF.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo nome="rgDataEmissao" rotulo="Data de emissão">
          <Input
            id="rgDataEmissao"
            name="rgDataEmissao"
            type="date"
            defaultValue={valores.rgDataEmissao}
            max={hojeIso}
            className="h-11"
          />
        </Campo>
        <Campo nome="cpf" rotulo="CPF" dica="Conferido pelo dígito verificador.">
          <Input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            defaultValue={valores.cpf}
            placeholder="000.000.000-00"
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* --------------------------------------------- escola e medidas */}
      <Secao titulo="Escola e medidas">
        <Campo nome="escola" rotulo="Escola">
          <Input
            id="escola"
            name="escola"
            defaultValue={valores.escola}
            className="h-11"
          />
        </Campo>
        <Campo nome="serie" rotulo="Série">
          <Input
            id="serie"
            name="serie"
            defaultValue={valores.serie}
            className="h-11"
          />
        </Campo>
        <Campo nome="peso" rotulo="Peso (kg)">
          <Input
            id="peso"
            name="peso"
            inputMode="decimal"
            defaultValue={valores.peso}
            placeholder="34,5"
            className="h-11"
          />
        </Campo>
        <Campo nome="altura" rotulo="Altura (m)">
          <Input
            id="altura"
            name="altura"
            inputMode="decimal"
            defaultValue={valores.altura}
            placeholder="1,42"
            className="h-11"
          />
        </Campo>
      </Secao>

      {/* --------------------------------------------- avisos e envio */}
      {avisos.length > 0 ? (
        <Alert role="status">
          <AlertTitle>Avisos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {avisos.map((aviso) => (
                <li key={aviso.codigo}>{aviso.texto}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Avisos informam e não impedem o cadastro. Nenhum deles muda nada
              sozinho.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {turmaLotada ? (
        <Alert variant={podeAutorizarCapacidade ? "default" : "destructive"}>
          <AlertTitle>Turma cheia</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {turma?.nome} está com {turma?.ocupacao} de {turma?.capacidade}{" "}
              vagas ocupadas.
            </p>
            {podeAutorizarCapacidade ? (
              <div className="w-full space-y-2">
                <Label htmlFor="justificativaCapacidade">
                  Justificativa da autorização
                </Label>
                <Textarea
                  id="justificativaCapacidade"
                  name="justificativaCapacidade"
                  placeholder="Por que esta matrícula entra acima da capacidade?"
                />
                <p className="text-xs">
                  Fica gravado quem autorizou, quando e por quê. A turma passa a
                  mostrar a ocupação acima do limite.
                </p>
              </div>
            ) : (
              <p>
                Só um administrador pode autorizar matrícula acima da
                capacidade. Escolha outra turma ou peça a autorização.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {estado.exigeAutorizacao ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.exigeAutorizacao}</AlertDescription>
        </Alert>
      ) : null}

      {estado.duplicidade ? (
        <Alert role="status">
          <AlertTitle>Possível duplicidade</AlertTitle>
          <AlertDescription>
            {estado.duplicidade.mensagem} Salvar de novo cadastra assim mesmo.
          </AlertDescription>
        </Alert>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="bg-background/95 sticky bottom-0 flex flex-wrap items-center gap-2 border-t py-3 backdrop-blur">
        <Enviar>
          {estado.duplicidade ? "Cadastrar assim mesmo" : rotuloSalvar}
        </Enviar>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={hrefCancelar}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
