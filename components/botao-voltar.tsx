import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Retorno explícito de uma subtela para a tela principal do módulo.
 *
 * Toda subtela leva um destes. O destino é fixo e escrito na chamada, não
 * `history.back()`: quem chega por URL digitada, por link ou depois de um
 * redirect não tem histórico útil, e o botão precisa funcionar igual nos três
 * casos.
 *
 * Alvo de toque de 44 px porque o app é usado no celular, de pé.
 */
export function BotaoVoltar({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 h-11 self-start px-2 md:h-9"
    >
      <Link href={href}>
        <ChevronLeft className="size-4" />
        {children}
      </Link>
    </Button>
  );
}
