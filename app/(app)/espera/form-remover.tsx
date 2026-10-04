"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { removerDaEspera, type EstadoEspera } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="min-h-11">
      {pending ? "Gravando…" : "Confirmar remoção"}
    </Button>
  );
}

/**
 * Saída da fila sem conversão. Atrás de uma confirmação e com motivo escrito,
 * como o desligamento de aluno. Nada é apagado.
 */
export function FormRemoverEspera({ id, nome }: { id: string; nome: string }) {
  const [estado, acao] = useActionState<EstadoEspera, FormData>(removerDaEspera, {});
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!aberto) {
    return (
      <Button variant="ghost" className="min-h-11" onClick={() => setAberto(true)}>
        Remover da fila
      </Button>
    );
  }

  return (
    <form action={acao} className="w-full space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-2">
        <Label htmlFor={`motivo_${id}`}>Motivo da remoção</Label>
        <Textarea
          id={`motivo_${id}`}
          name="motivo"
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Desistiu, não atende o telefone, matriculou em outro lugar…"
        />
        <p className="text-muted-foreground text-xs">
          {nome} sai da fila. O registro continua consultável em Removidos, com
          o motivo e quem removeu.
        </p>
      </div>
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Confirmar />
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
