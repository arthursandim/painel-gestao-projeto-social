"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  alternarAtivo,
  atualizarPapeis,
  criarUsuario,
  redefinirSenha,
  type EstadoForm,
} from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Recado({ estado }: { estado: EstadoForm }) {
  if (estado.erro) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{estado.erro}</AlertDescription>
      </Alert>
    );
  }
  if (estado.ok) {
    return (
      <Alert role="status">
        <AlertDescription>{estado.ok}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function Enviar({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "outline" | "destructive" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      className="min-h-11 md:min-h-9"
    >
      {pending ? "Salvando…" : children}
    </Button>
  );
}

export function FormNovoUsuario({ campos }: { campos: React.ReactNode }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(criarUsuario, {});

  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoCapitalize="none"
            required
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha inicial</Label>
        <Input
          id="senha"
          name="senha"
          type="text"
          minLength={8}
          required
          className="h-11"
        />
        <p className="text-muted-foreground text-xs">
          Ao menos 8 caracteres. O app não envia e-mail — entregue a senha
          pessoalmente e troque-a aqui quando precisar.
        </p>
      </div>

      {campos}

      <Recado estado={estado} />

      <div className="flex flex-wrap items-center gap-2">
        <Enviar>Criar usuário</Enviar>
        <Button asChild variant="ghost" size="sm" className="min-h-11 md:min-h-9">
          <Link href="/config">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

export function FormPapeis({
  usuarioId,
  campos,
}: {
  usuarioId: string;
  campos: React.ReactNode;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(
    atualizarPapeis,
    {},
  );

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      {campos}
      <Recado estado={estado} />
      <Enviar variant="outline">Salvar papéis</Enviar>
    </form>
  );
}

export function FormAtivo({
  usuarioId,
  ativo,
}: {
  usuarioId: string;
  ativo: boolean;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(
    alternarAtivo,
    {},
  );

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <Recado estado={estado} />
      <Enviar variant={ativo ? "destructive" : "secondary"}>
        {ativo ? "Desativar acesso" : "Reativar acesso"}
      </Enviar>
    </form>
  );
}

export function FormSenha({ usuarioId }: { usuarioId: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(
    redefinirSenha,
    {},
  );

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <div className="space-y-2">
        <Label htmlFor={`senha-${usuarioId}`}>Nova senha</Label>
        <Input
          id={`senha-${usuarioId}`}
          name="senha"
          type="text"
          minLength={8}
          required
          className="h-11"
        />
      </div>
      <Recado estado={estado} />
      <Enviar variant="outline">Redefinir senha</Enviar>
    </form>
  );
}
