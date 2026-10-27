"use client";

import { entrar, type EstadoLogin } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnvioSemLimpar } from "@/lib/useEnvioSemLimpar";

export function FormularioLogin({ proximo }: { proximo: string }) {
  const { estado, aoEnviar, pendente } = useEnvioSemLimpar<EstadoLogin>(entrar, {});

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
      </div>

      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <Botao pendente={pendente} />
    </form>
  );
}

function Botao({ pendente }: { pendente: boolean }) {
  return (
    <Button type="submit" className="h-11 w-full" disabled={pendente}>
      {pendente ? "Entrando…" : "Entrar"}
    </Button>
  );
}
