import { ImageOff } from "lucide-react";

import { cn } from "cn";

/**
 * Foto do aluno ou do item, ou o quadro vazio.
 *
 * `<img>` cru, e não next/image, de propósito: a URL é assinada e de vida curta,
 * e o otimizador do Next guardaria a imagem em cache no servidor — foto de
 * criança não fica em cache (mesma regra do PWA).
 */
export function QuadroFoto({
  url,
  alt,
  className,
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <ImageOff className="text-muted-foreground size-6" aria-label="Sem foto" />
      )}
    </div>
  );
}
