"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { CapturaFoto } from "@/components/captura-foto";
import { QuadroFoto } from "@/components/quadro-foto";
import { Button } from "@/components/ui/button";

/**
 * Foto no formulário de criação (aluno e item). O registro ainda não existe —
 * não há matrícula nem id para o caminho do arquivo —, então a foto fica no
 * navegador e vai junto com o "Salvar"; o servidor confere antes de criar e
 * grava o arquivo logo depois.
 *
 * Controlado pelo formulário: a foto continua escolhida se a validação recusar
 * outro campo, como os demais campos controlados.
 */
export function CampoFoto({
  foto,
  aoMudar,
  rotulo,
}: {
  foto: Blob | null;
  aoMudar: (foto: Blob | null) => void;
  rotulo: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  // Prévia por URL local, revogada quando a foto muda ou o campo sai da tela.
  useEffect(() => {
    if (!foto) return;
    const nova = URL.createObjectURL(foto);
    // A URL é recurso externo ao React: criar e guardar aqui é sincronizar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(nova);
    return () => {
      URL.revokeObjectURL(nova);
      setUrl(null);
    };
  }, [foto]);

  return (
    <div className="flex items-start gap-4">
      <QuadroFoto url={foto ? url : null} alt={rotulo} />
      <div className="space-y-2">
        <p className="text-sm font-medium">{rotulo}</p>
        <p className="text-muted-foreground text-xs">
          Opcional. Vai junto com o cadastro, ao salvar.
        </p>
        <CapturaFoto aoConfirmar={aoMudar} temFoto={Boolean(foto)} />
        {foto ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => aoMudar(null)}>
            <X className="size-4" />
            Remover foto
          </Button>
        ) : null}
      </div>
    </div>
  );
}
