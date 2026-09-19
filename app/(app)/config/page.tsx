import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Configuração — Engenho Cidadão" };

export default function ConfigPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Configuração</h1>
        <p className="text-muted-foreground text-sm">
          Área exclusiva de administração.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/config/usuarios" className="block">
          <Card className="hover:border-foreground/30 h-full transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Usuários</CardTitle>
              <CardDescription>
                Criar contas, definir papéis, desativar acesso e redefinir
                senha.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className="h-full opacity-60">
          <CardHeader>
            <CardTitle className="text-base">Parâmetros</CardTitle>
            <CardDescription>
              Capacidade de cada turma e o número de faltas consecutivas que
              dispara o alerta. Fase 7 do roteiro.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
