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
      {/* `width`/`height` são as dimensões reais do arquivo, não o tamanho na
          tela — quem dimensiona é o CSS, preservando a proporção. O logo da
          equipe tem 256×259, então forçá-lo em quadrado o esticava 1% e fazia
          o Next avisar a cada render. */}
      <div className="flex items-center gap-2">
        <Chip lado={lado}>
          <Image
            src="/logo-projeto-256.png"
            alt="Projeto Social Engenho Cidadão"
            width={256}
            height={256}
            className="h-auto max-h-full w-auto max-w-full object-contain"
            priority
          />
        </Chip>
        <Chip lado={lado}>
          <Image
            src="/logo-equipe-256.png"
            alt="Equipe Sul Tucujú"
            width={256}
            height={259}
            className="h-auto max-h-full w-auto max-w-full object-contain"
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
