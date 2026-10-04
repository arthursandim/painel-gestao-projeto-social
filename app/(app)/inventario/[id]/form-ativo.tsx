"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { alterarAtivoItem, type EstadoItem } from "../acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { decidirComEmprestimoAberto } from "@/lib/estoque";

function Confirmar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="min-h-11">
      {pending ? "Gravando…" : children}
    </Button>
  );
}

/**
 * Desativar e reativar o item, atrás de uma confirmação. Nada é apagado.
 *
 * Com empréstimo em aberto, INVENTARIO é barrado e o ADMIN confirma lendo o
 * aviso. A tela só antecipa o que o servidor decide de novo.
 */
export function FormAtivoItem({
  itemId,
  ativo,
  emprestados,
  admin,
}: {
  itemId: string;
  ativo: boolean;
  emprestados: number;
  admin: boolean;
}) {
  const [estado, acao] = useActionState<EstadoItem, FormData>(alterarAtivoItem, {});
  const [aberto, setAberto] = useState(false);

  const decisao = ativo ? decidirComEmprestimoAberto("desativar", emprestados, admin) : null;

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
          {ativo ? "Desativar item" : "Reativar item"}
        </Button>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="ativo" value={ativo ? "false" : "true"} />
      {decisao && "erro" in decisao ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{decisao.erro}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm">
          {ativo
            ? "O item sai da lista padrão e deixa de receber empréstimo e movimento. O histórico continua consultável e ele pode ser reativado."
            : "O item volta à lista e pode receber empréstimo e movimento de novo."}
        </p>
      )}
      {decisao && "aviso" in decisao ? (
        <Alert role="status">
          <AlertDescription>{decisao.aviso}</AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {decisao && "erro" in decisao ? null : (
          <Confirmar>{ativo ? "Confirmar desativação" : "Confirmar reativação"}</Confirmar>
        )}
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
