import type { Metadata } from "next";

import { FormularioLogin } from "./formulario-login";
import { Marca } from "@/components/marca";
import { Card, CardContent } from "@/components/ui/card";
import { rotaInternaSegura } from "@/lib/rotaSegura";

export const metadata: Metadata = { title: "Entrar — Engenho Cidadão" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { proximo } = await searchParams;
  const destino = rotaInternaSegura(
    typeof proximo === "string" ? proximo : null,
  );

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <Marca tamanho="grande" className="justify-center" />

        <Card>
          <CardContent className="pt-6">
            <FormularioLogin proximo={destino} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          Acesso restrito à diretoria e aos professores. As contas são criadas
          por um administrador — não há cadastro nesta tela.
        </p>
      </div>
    </main>
  );
}
