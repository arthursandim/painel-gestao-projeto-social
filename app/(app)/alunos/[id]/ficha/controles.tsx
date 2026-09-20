"use client";

import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Uma folha A4 tem 210 mm, que a 96 dpi são 794 px. Abaixo disso a prévia é
 * reduzida para caber, e a impressão a partir dali tende a sair desalinhada.
 */
const CABE_UMA_FOLHA = "(min-width: 820px)";

/**
 * Botão de imprimir e o aviso de tela pequena.
 *
 * O aviso testa CAPACIDADE — quanta largura existe — e não o user agent. Um
 * notebook com a janela estreita recebe o aviso; um tablet largo na horizontal
 * não recebe. Testar o aparelho erraria nos dois casos.
 *
 * E o aviso acompanha o recurso: fica ao lado do botão, que continua
 * funcionando. Em nenhuma largura a tela é substituída por "abra no
 * computador" — o CLAUDE.md proíbe, e com razão: imprimir do celular para uma
 * impressora de rede funciona, só sai torto.
 */
export function ControlesFicha() {
  // null até a primeira medida, para não piscar um aviso que talvez não valha.
  const [cabe, setCabe] = useState<boolean | null>(null);

  useEffect(() => {
    const consulta = window.matchMedia(CABE_UMA_FOLHA);
    const aplicar = () => setCabe(consulta.matches);

    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  return (
    <div className="space-y-3 print:hidden">
      <Button
        type="button"
        onClick={() => window.print()}
        className="min-h-11 w-full sm:w-auto"
      >
        <Printer className="size-4" />
        Imprimir ficha
      </Button>

      {cabe === false ? (
        <Alert role="status">
          <AlertDescription>
            A tela é mais estreita que uma folha A4, então a prévia aqui embaixo
            aparece reduzida. Imprimir funciona, mas o A4 costuma sair
            desalinhado a partir do celular — se puder, imprima do computador e
            confira as margens antes de colher assinatura.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
