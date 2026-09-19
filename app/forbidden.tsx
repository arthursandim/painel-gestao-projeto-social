import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Resposta de forbidden(): 403, quando a sessão existe mas o papel não alcança. */
export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-muted-foreground font-mono text-sm">403</p>
        <h1 className="text-2xl font-semibold">Acesso não permitido</h1>
        <p className="text-muted-foreground text-sm">
          Seu perfil não alcança esta tela. Se precisa dela para o seu trabalho,
          peça a um administrador do projeto.
        </p>
        <Button asChild variant="outline">
          <Link href="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    </main>
  );
}
