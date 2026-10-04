"use client";

import { ImageOff, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Foto do aluno ou do item, ou o quadro vazio. Tocar na foto abre a
 * visualização ampliada por cima da tela.
 *
 * A visualização é o `<dialog>` nativo aberto com `showModal()`: o navegador já
 * entrega a camada por cima de tudo, o foco preso dentro, o Esc para fechar e o
 * fundo (`::backdrop`). Fecha também pelo X e pelo toque fora da foto — o toque
 * no fundo chega ao próprio `<dialog>` como alvo, o toque na foto chega à foto.
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
  const dialogo = useRef<HTMLDialogElement>(null);

  const moldura = cn(
    "bg-muted flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border",
    className,
  );

  if (!url) {
    return (
      <div className={moldura}>
        <ImageOff className="text-muted-foreground size-6" aria-label="Sem foto" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(moldura, "cursor-zoom-in focus-visible:ring-ring/50 outline-none focus-visible:ring-3")}
        onClick={() => dialogo.current?.showModal()}
        aria-label={`Ampliar: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="size-full object-cover" />
      </button>

      <dialog
        ref={dialogo}
        aria-label={alt}
        // Toque fora da foto: o alvo é o próprio <dialog> (o fundo).
        onClick={(e) => e.target === e.currentTarget && dialogo.current?.close()}
        className="m-auto max-h-[95dvh] max-w-[95vw] overflow-visible bg-transparent p-0 backdrop:bg-black/80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="block max-h-[90dvh] max-w-[95vw] rounded-md object-contain"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 size-11 rounded-full"
          onClick={() => dialogo.current?.close()}
          aria-label="Fechar"
        >
          <X className="size-5" />
        </Button>
      </dialog>
    </>
  );
}
