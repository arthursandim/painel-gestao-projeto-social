"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { emprestar, type EstadoItem } from "../acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatarDiaBr } from "@/lib/data";

export type AlunoOpcao = { id: string; nome: string; matricula: string; turma: string };

function Emprestar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Gravando…" : "Confirmar empréstimo"}
    </Button>
  );
}

/** Empresta uma unidade. Só alunos ativos são oferecidos; o servidor confere de novo. */
export function FormEmprestar({
  itemId,
  alunos,
  hojeIso,
}: {
  itemId: string;
  alunos: readonly AlunoOpcao[];
  hojeIso: string;
}) {
  const [aberto, setAberto] = useState(false);
  // Controlados: o React 19 reseta os não controlados depois do envio.
  const [alunoId, setAlunoId] = useState("");
  const [data, setData] = useState(hojeIso);
  const [observacao, setObservacao] = useState("");

  const [estado, enviar] = useActionState<EstadoItem, FormData>(async (anterior, form) => {
    const resultado = await emprestar(anterior, form);
    if (resultado.ok) {
      setAlunoId("");
      setData(hojeIso);
      setObservacao("");
      setAberto(false);
    }
    return resultado;
  }, {});

  if (!aberto) {
    return (
      <div className="space-y-3">
        {estado.ok ? (
          <Alert role="status">
            <AlertDescription>{estado.ok}</AlertDescription>
          </Alert>
        ) : null}
        <Button className="min-h-11" onClick={() => setAberto(true)}>
          Emprestar a um aluno
        </Button>
      </div>
    );
  }

  const retroativo = data !== "" && data < hojeIso;

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="alunoId">Aluno</Label>
          <Select
            id="alunoId"
            name="alunoId"
            required
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
          >
            <option value="" disabled>
              Escolha
            </option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} — {a.matricula} · {a.turma}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataEmprestimo">Data do empréstimo</Label>
          <Input
            id="dataEmprestimo"
            name="data"
            type="date"
            required
            max={hojeIso}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacaoEmprestimo">Observação</Label>
          <Textarea
            id="observacaoEmprestimo"
            name="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Estado em que saiu, combinado de devolução…"
          />
        </div>
      </div>
      {retroativo ? (
        <Alert role="status">
          <AlertDescription>
            Empréstimo retroativo: {formatarDiaBr(data)}, não hoje ({formatarDiaBr(hojeIso)}).
          </AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Emprestar />
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
