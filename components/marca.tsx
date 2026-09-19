import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * As duas marcas lado a lado, seguidas do nome em duas linhas.
 *
 * Ambas são predominantemente pretas, por isso cada uma vai dentro de um chip
 * claro. O chip é de cantos arredondados e não redondo: a engrenagem do Engenho
 * Cidadão tem dentes que chegam aos cantos do enquadramento e um recorte
 * circular os cortaria.
 *
 * Os caminhos dos arquivos são fixos em código, nunca no banco.
 */
export function Marca({
  className,
  tamanho = "normal",
}: {
  className?: string;
  tamanho?: "normal" | "grande";
}) {
  const lado = tamanho === "grande" ? 48 : 34;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <Chip lado={lado}>
          <Image
            src="/logo-projeto-256.png"
            alt="Projeto Social Engenho Cidadão"
            width={lado}
            height={lado}
            className="object-contain"
            priority
          />
        </Chip>
        <Chip lado={lado}>
          <Image
            src="/logo-equipe-256.png"
            alt="Equipe Sul Tucujú"
            width={lado}
            height={lado}
            className="object-contain"
            priority
          />
        </Chip>
      </div>

      <div className="leading-tight">
        <p
          className={cn(
            "font-semibold",
            tamanho === "grande" ? "text-xl" : "text-sm",
          )}
        >
          Engenho Cidadão
        </p>
        <p
          className={cn(
            "opacity-70",
            tamanho === "grande" ? "text-sm" : "text-xs",
          )}
        >
          Equipe Sul Tucujú
        </p>
      </div>
    </div>
  );
}

function Chip({
  lado,
  children,
}: {
  lado: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-white p-1 ring-1 ring-black/10"
      style={{ width: lado + 8, height: lado + 8 }}
    >
      {children}
    </span>
  );
}
