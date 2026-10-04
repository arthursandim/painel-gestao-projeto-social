"use client";

import { TipoMovimento } from "@prisma/client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { registrarMovimento, type EstadoItem } from "../acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatarDiaBr } from "@/lib/data";

function Registrar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Gravando…" : "Registrar movimento"}
    </Button>
  );
}

/**
 * Entrada e saída de estoque. Saída é só definitiva — perda, descarte, doação.
 * Emprestar não passa por aqui.
 */
export function FormMovimento({
  itemId,
  disponivel,
  unidade,
  hojeIso,
}: {
  itemId: string;
  disponivel: number;
  unidade: string;
  /** "Hoje" vem do servidor, no fuso do projeto. */
  hojeIso: string;
}) {
  const [aberto, setAberto] = useState(false);
  // Controlados: o React 19 reseta os não controlados depois do envio.
  const [tipo, setTipo] = useState<TipoMovimento>(TipoMovimento.ENTRADA);
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hojeIso);
  const [motivo, setMotivo] = useState("");

  const [estado, enviar] = useActionState<EstadoItem, FormData>(async (anterior, form) => {
    const resultado = await registrarMovimento(anterior, form);
    if (resultado.ok) {
      setQuantidade("");
      setMotivo("");
      setData(hojeIso);
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
        <Button variant="outline" className="min-h-11" onClick={() => setAberto(true)}>
          Entrada ou saída de estoque
        </Button>
      </div>
    );
  }

  const retroativa = data !== "" && data < hojeIso;

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimento)}
          >
            <option value={TipoMovimento.ENTRADA}>Entrada</option>
            <option value={TipoMovimento.SAIDA}>Saída definitiva</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade ({unidade})</Label>
          <Input
            id="quantidade"
            name="quantidade"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            name="data"
            type="date"
            required
            max={hojeIso}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="motivo">Motivo</Label>
          <Textarea
            id="motivo"
            name="motivo"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={
              tipo === TipoMovimento.ENTRADA
                ? "Doação recebida, compra, correção de contagem…"
                : "Descarte por desgaste, doação, perda no estoque, correção de contagem…"
            }
          />
        </div>
      </div>

      {tipo === TipoMovimento.SAIDA ? (
        <p className="text-muted-foreground text-xs">
          Saída é definitiva e só sai do que está disponível ({disponivel} {unidade}).
          Unidade emprestada volta pela devolução ou sai pela marcação de perdido.
        </p>
      ) : null}
      {retroativa ? (
        <Alert role="status">
          <AlertDescription>
            Movimento retroativo: {formatarDiaBr(data)}, não hoje ({formatarDiaBr(hojeIso)}).
          </AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Registrar />
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
