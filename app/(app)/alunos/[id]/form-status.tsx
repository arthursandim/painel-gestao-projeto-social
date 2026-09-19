"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { alternarStatusAluno, type EstadoAluno } from "../acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Confirmar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="min-h-11"
    >
      {pending ? "Gravando…" : children}
    </Button>
  );
}

/**
 * Desligamento e reativação.
 *
 * O desligamento é o que libera a vaga, então ele é uma decisão de pessoa: fica
 * atrás de uma confirmação e exige motivo escrito. Nenhum alerta do painel
 * chega aqui sozinho — os cinco cards levam à lista, e a lista ao cadastro.
 */
export function FormStatusAluno({
  alunoId,
  ativo,
  nome,
}: {
  alunoId: string;
  ativo: boolean;
  nome: string;
}) {
  const [estado, acao] = useActionState<EstadoAluno, FormData>(
    alternarStatusAluno,
    {},
  );
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <div className="space-y-3">
        {estado.ok ? (
          <Alert role="status">
            <AlertDescription>{estado.ok}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          variant={ativo ? "outline" : "secondary"}
          className="min-h-11"
          onClick={() => setAberto(true)}
        >
          {ativo ? "Desligar aluno" : "Reativar aluno"}
        </Button>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={alunoId} />

      {ativo ? (
        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo do desligamento</Label>
          <Textarea
            id="motivo"
            name="motivo"
            required
            placeholder="Mudou de cidade, parou de frequentar, pedido da família…"
          />
          <p className="text-muted-foreground text-xs">
            {nome} sai da turma e a vaga fica livre para a lista de espera. Nada
            é apagado: o cadastro continua inteiro, com o histórico.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {nome} volta a ocupar uma vaga na turma. Se a turma estiver cheia, a
          reativação passa pela mesma autorização de uma matrícula nova.
        </p>
      )}

      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      {estado.exigeAutorizacao ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.exigeAutorizacao}</AlertDescription>
        </Alert>
      ) : null}

      {estado.exigeAutorizacao ? (
        <div className="space-y-2">
          <Label htmlFor="justificativaCapacidade">
            Justificativa da autorização
          </Label>
          <Textarea
            id="justificativaCapacidade"
            name="justificativaCapacidade"
            required
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Confirmar>{ativo ? "Confirmar desligamento" : "Confirmar reativação"}</Confirmar>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
