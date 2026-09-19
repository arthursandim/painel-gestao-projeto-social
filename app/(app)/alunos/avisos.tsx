import { TriangleAlert } from "lucide-react";

import type { Aviso } from "@/lib/avisosAluno";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

/**
 * Os avisos permanentes, como eles aparecem na tela.
 *
 * Sem botão nenhum, de propósito: o CLAUDE.md diz que os avisos informam e
 * nunca agem. Quem resolve é a pessoa, no campo correspondente do cadastro —
 * e um botão "corrigir" aqui seria exatamente a ação automática que o projeto
 * decidiu não ter.
 */
export function ListaDeAvisos({ avisos }: { avisos: readonly Aviso[] }) {
  if (avisos.length === 0) return null;

  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>
        {avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {avisos.map((aviso) => (
            <li key={aviso.codigo}>{aviso.texto}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** Marcador compacto, para a linha da lista. */
export function SeloDeAvisos({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return null;
  return (
    <Badge variant="destructive" title="Avisos no cadastro">
      <TriangleAlert />
      {quantidade}
    </Badge>
  );
}
