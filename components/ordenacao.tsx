import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { urlDaOrdem, type Ordem } from "@/lib/ordenacao";
import { cn } from "cn";

type Params = Record<string, string | string[] | undefined>;

/**
 * Cabeçalho de coluna que ordena. Tocar ordena crescente; tocar de novo
 * inverte. É um link (GET), não JavaScript: a ordem fica na URL junto com os
 * filtros.
 */
export function CabecalhoOrdenavel({
  rotulo,
  campo,
  ordem,
  caminho,
  params,
  direita = false,
}: {
  rotulo: string;
  campo: string;
  ordem: Ordem<string>;
  caminho: string;
  params: Params;
  direita?: boolean;
}) {
  const ativa = ordem.campo === campo;
  const Icone = !ativa ? ArrowUpDown : ordem.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("px-3 py-2 font-medium", direita && "text-right")}
      aria-sort={!ativa ? "none" : ordem.dir === "asc" ? "ascending" : "descending"}
    >
      <Link
        href={urlDaOrdem(caminho, params, ordem, campo)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline",
          direita && "flex-row-reverse",
          !ativa && "text-muted-foreground",
        )}
      >
        {rotulo}
        <Icone className={cn("size-3.5", !ativa && "opacity-50")} aria-hidden />
      </Link>
    </th>
  );
}

/**
 * A mesma ordem para o celular, onde a tabela vira cartões e não há cabeçalho
 * para tocar. Vai dentro do formulário de filtros (GET).
 */
export function SeletorOrdem({
  colunas,
  ordem,
}: {
  colunas: readonly { campo: string; rotulo: string }[];
  ordem: Ordem<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:hidden">
      <div className="space-y-2">
        <Label htmlFor="ordem">Ordenar por</Label>
        <Select id="ordem" name="ordem" defaultValue={ordem.campo}>
          {colunas.map((c) => (
            <option key={c.campo} value={c.campo}>
              {c.rotulo}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dir">Ordem</Label>
        <Select id="dir" name="dir" defaultValue={ordem.dir}>
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </Select>
      </div>
    </div>
  );
}
