import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

/**
 * Lista suspensa nativa, e não o Select do Radix.
 *
 * Dois motivos. O CLAUDE.md pede que a escala da graduação apareça como
 * cabeçalho de grupo dentro da lista, e `optgroup` é isso — o Radix monta um
 * listbox próprio, onde "grupo" é decoração sem semântica. E a tela é usada de
 * pé, no celular: o select nativo abre a roleta do sistema, com alvo de toque
 * do tamanho do aparelho, enquanto o listbox custom vira uma lista miúda.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-9 md:text-sm dark:bg-input/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  );
}

export { Select };
