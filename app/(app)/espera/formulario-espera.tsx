"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { EstadoEspera } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ehDiaValido, idadeEm } from "@/lib/data";
import { IDADE_JOVENS_ADULTOS, turmaEsperada } from "@/lib/turma";
import { mascaraTelefone } from "@/lib/validacoes";

export type TurmaEspera = { id: string; codigo: string; nome: string };

export type ValoresEspera = {
  nome: string;
  nascimento: string;
  telefone: string;
  turmaPretendidaId: string;
  dataEntrada: string;
  observacao: string;
};

function Salvar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Salvando…" : children}
    </Button>
  );
}

export function FormularioEspera({
  acao,
  turmas,
  valores,
  id,
  hojeIso,
  rotuloSalvar,
}: {
  acao: (estado: EstadoEspera, form: FormData) => Promise<EstadoEspera>;
  turmas: readonly TurmaEspera[];
  valores: ValoresEspera;
  id?: string;
  /** "Hoje" vem do servidor, no fuso do projeto. */
  hojeIso: string;
  rotuloSalvar: string;
}) {
  const [estado, enviar] = useActionState<EstadoEspera, FormData>(acao, {});

  // Controlados: o React 19 reseta campos não controlados depois do envio, e um
  // erro de validação apagaria o que foi digitado.
  const [nome, setNome] = useState(valores.nome);
  const [nascimento, setNascimento] = useState(valores.nascimento);
  const [telefone, setTelefone] = useState(valores.telefone);
  const [turmaId, setTurmaId] = useState(valores.turmaPretendidaId);
  const [dataEntrada, setDataEntrada] = useState(valores.dataEntrada);
  const [observacao, setObservacao] = useState(valores.observacao);
  const [avisoTurma, setAvisoTurma] = useState("");

  /**
   * Corte dos 12, o mesmo do cadastro de aluno. Preenche a turma e avisa; a
   * outra continua na lista — idade incompatível é alerta, nunca bloqueio.
   * Só age quando a data muda.
   */
  function aoMudarNascimento(novo: string) {
    setNascimento(novo);
    if (!ehDiaValido(novo) || novo > hojeIso) return;
    const idade = idadeEm(novo, hojeIso);
    const sugerida = turmas.find((t) => t.codigo === turmaEsperada(idade));
    if (!sugerida) return;
    if (sugerida.id !== turmaId) {
      setTurmaId(sugerida.id);
      setAvisoTurma(
        `Com ${idade} anos a turma é ${sugerida.nome} (a partir dos ${IDADE_JOVENS_ADULTOS} anos deixa de ser Kids). Pode trocar se for o caso.`,
      );
    } else {
      setAvisoTurma("");
    }
  }

  return (
    <form action={enviar} className="space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nascimento">Nascimento</Label>
          <Input
            id="nascimento"
            name="nascimento"
            type="date"
            required
            max={hojeIso}
            value={nascimento}
            onChange={(e) => aoMudarNascimento(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            placeholder="(48) 99123-4567"
            value={telefone}
            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            Com DDD. Para criança, o do responsável.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="turmaPretendidaId">Turma pretendida</Label>
          <Select
            id="turmaPretendidaId"
            name="turmaPretendidaId"
            required
            value={turmaId}
            onChange={(e) => {
              setTurmaId(e.target.value);
              setAvisoTurma("");
            }}
          >
            <option value="" disabled>
              Escolha
            </option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataEntrada">Data de entrada na fila</Label>
          <Input
            id="dataEntrada"
            name="dataEntrada"
            type="date"
            required
            max={hojeIso}
            value={dataEntrada}
            onChange={(e) => setDataEntrada(e.target.value)}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            Decide a posição na fila. Para quem já estava na lista em papel, use
            a data original.
          </p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea
            id="observacao"
            name="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </div>

      {avisoTurma ? (
        <Alert role="status">
          <AlertDescription>{avisoTurma}</AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Salvar>{rotuloSalvar}</Salvar>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/espera">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
