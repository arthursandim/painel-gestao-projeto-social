"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { sair } from "@/app/(auth)/login/acoes";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ItemMenu = { rota: string; titulo: string };

export function Cabecalho({
  nome,
  papeis,
  itens,
}: {
  nome: string;
  papeis: string[];
  itens: ItemMenu[];
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  const ativo = (rota: string) =>
    pathname === rota || pathname.startsWith(`${rota}/`);

  return (
    <header className="bg-neutral-900 text-neutral-50">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/painel" className="shrink-0">
          <Marca />
        </Link>

        {/* Acima de 768 px o menu fica aberto na própria barra. */}
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {itens.map((item) => (
            <Link
              key={item.rota}
              href={item.rota}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                ativo(item.rota)
                  ? "bg-neutral-50 text-neutral-900"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50",
              )}
            >
              {item.titulo}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <div className="text-right leading-tight">
            <p className="text-sm">{nome}</p>
            <p className="text-xs text-neutral-400">{papeis.join(" · ")}</p>
          </div>
          <BotaoSair />
        </div>

        {/* Abaixo de 768 px a navegação fica recolhida. */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-md text-neutral-200 hover:bg-neutral-800 md:hidden"
        >
          {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {aberto ? (
        <div className="border-t border-neutral-800 px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {itens.map((item) => (
              <Link
                key={item.rota}
                href={item.rota}
                onClick={() => setAberto(false)}
                className={cn(
                  // Alvo de toque grande: a barra é usada de pé, com o celular
                  // na mão.
                  "flex min-h-11 items-center rounded-md px-3 text-sm",
                  ativo(item.rota)
                    ? "bg-neutral-50 text-neutral-900"
                    : "text-neutral-300 hover:bg-neutral-800",
                )}
              >
                {item.titulo}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-800 pt-3">
            <div className="leading-tight">
              <p className="text-sm">{nome}</p>
              <p className="text-xs text-neutral-400">{papeis.join(" · ")}</p>
            </div>
            <BotaoSair />
          </div>
        </div>
      ) : null}
    </header>
  );
}

function BotaoSair() {
  return (
    <form action={sair}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-9 border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
      >
        Sair
      </Button>
    </form>
  );
}
