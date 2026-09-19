import type { Papel } from "@prisma/client";

import { DESCRICAO_PAPEL, PAPEIS, ROTULO_PAPEL } from "@/lib/permissoes";

/**
 * Um usuário acumula papéis, então o campo é uma lista de caixas, nunca uma
 * lista suspensa de escolha única.
 *
 * Caixa nativa, e não o Checkbox do shadcn: o do Radix é um <button> que
 * espelha o valor num input escondido, e num formulário que decide permissão
 * não vale a pena depender desse espelho. O nativo envia o valor ou não envia,
 * e `formData.getAll("papeis")` devolve exatamente os marcados.
 */
export function SeletorPapeis({
  id,
  selecionados,
}: {
  id: string;
  selecionados: readonly Papel[];
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-2 text-sm font-medium">Papéis</legend>
      {PAPEIS.map((papel) => {
        const campoId = `${id}-${papel}`;
        return (
          <label
            key={papel}
            htmlFor={campoId}
            className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2"
          >
            <input
              id={campoId}
              type="checkbox"
              name="papeis"
              value={papel}
              defaultChecked={selecionados.includes(papel)}
              className="accent-primary mt-1 size-4"
            />
            <span className="flex-1">
              <span className="block text-sm">{ROTULO_PAPEL[papel]}</span>
              <span className="text-muted-foreground block text-xs">
                {DESCRICAO_PAPEL[papel]}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
