"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { devolver, marcarPerdido, type EstadoItem } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarDiaBr } from "@/lib/data";

function Confirmar({ children, perigo }: { children: React.ReactNode; perigo?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={perigo ? "destructive" : "default"}
      disabled={pending}
      className="min-h-11"
    >
      {pending ? "Gravando…" : children}
    </Button>
  );
}

/**
 * Devolver ou marcar perdido um empréstimo aberto. Cada um atrás de uma
 * confirmação com data; a perda pede um detalhe opcional, que vai para o motivo
 * da saída de estoque que ela gera.
 */
export function AcoesEmprestimo({
  emprestimoId,
  dataEmprestimo,
  hojeIso,
}: {
  emprestimoId: string;
  dataEmprestimo: string;
  hojeIso: string;
}) {
  const [modo, setModo] = useState<"fechado" | "devolver" | "perdido">("fechado");
  const [data, setData] = useState(hojeIso);
  const [detalhe, setDetalhe] = useState("");
  const [estado, enviar] = useActionState<EstadoItem, FormData>(
    (anterior, form) => (form.get("modo") === "perdido" ? marcarPerdido : devolver)(anterior, form),
    {},
  );

  if (modo === "fechado") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" variant="secondary" onClick={() => setModo("devolver")}>
          Registrar devolução
        </Button>
        <Button className="min-h-11" variant="ghost" onClick={() => setModo("perdido")}>
          Marcar como perdido
        </Button>
      </div>
    );
  }

  const perdido = modo === "perdido";
  const retroativa = data !== "" && data < hojeIso;

  return (
    <form action={enviar} className="w-full space-y-3">
      <input type="hidden" name="emprestimoId" value={emprestimoId} />
      <input type="hidden" name="modo" value={modo} />
      <div className="space-y-2">
        <Label htmlFor={`data_${emprestimoId}`}>
          {perdido ? "Data em que se constatou a perda" : "Data da devolução"}
        </Label>
        <Input
          id={`data_${emprestimoId}`}
          name="data"
          type="date"
          required
          min={dataEmprestimo}
          max={hojeIso}
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-11 md:w-48"
        />
      </div>
      {perdido ? (
        <div className="space-y-2">
          <Label htmlFor={`detalhe_${emprestimoId}`}>Detalhe (opcional)</Label>
          <Textarea
            id={`detalhe_${emprestimoId}`}
            name="detalhe"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="O que aconteceu"
          />
          <p className="text-muted-foreground text-xs">
            A unidade sai do total por uma saída de estoque, gravada com seu nome.
            O empréstimo continua no histórico, marcado como perdido.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          A devolução fica registrada com seu nome, como quem recebeu.
        </p>
      )}
      {retroativa ? (
        <Alert role="status">
          <AlertDescription>
            Data retroativa: {formatarDiaBr(data)}, não hoje ({formatarDiaBr(hojeIso)}).
          </AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Confirmar perigo={perdido}>{perdido ? "Confirmar perda" : "Confirmar devolução"}</Confirmar>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setModo("fechado")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
