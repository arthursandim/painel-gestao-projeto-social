import type { Metadata } from "next";
import Link from "next/link";

import {
  FormAtivo,
  FormNovoUsuario,
  FormPapeis,
  FormSenha,
} from "./formularios";
import { SeletorPapeis } from "./seletor-papeis";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROTULO_PAPEL } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Usuários — Engenho Cidadão" };

export default async function UsuariosPage() {
  // O layout de /config já barrou quem não é admin; aqui só precisamos saber
  // quem é para não oferecer a esta pessoa o botão de desativar a si mesma.
  const eu = await usuarioAtual();

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      papeis: true,
      ativo: true,
      authUserId: true,
      criadoEm: true,
    },
  });

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          <Link href="/config" className="hover:underline">
            Configuração
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-muted-foreground text-sm">
          Contas são criadas aqui e em nenhum outro lugar — não existe
          auto-cadastro. Nada é apagado: quem sai é desativado e o histórico do
          que lançou continua atribuído a ele.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <FormNovoUsuario campos={<SeletorPapeis id="novo" selecionados={[]} />} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">
          {usuarios.length} {usuarios.length === 1 ? "conta" : "contas"}
        </h2>

        {usuarios.map((usuario) => (
          <Card key={usuario.id} data-ativo={usuario.ativo}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {usuario.nome}
                    {usuario.id === eu?.id ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        (você)
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription>{usuario.email}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {usuario.papeis.map((papel) => (
                    <Badge key={papel} variant="secondary">
                      {ROTULO_PAPEL[papel]}
                    </Badge>
                  ))}
                  <Badge variant={usuario.ativo ? "default" : "outline"}>
                    {usuario.ativo ? "Ativo" : "Desativado"}
                  </Badge>
                  {usuario.authUserId ? null : (
                    <Badge variant="destructive">Sem acesso vinculado</Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <FormPapeis
                usuarioId={usuario.id}
                campos={
                  <SeletorPapeis
                    id={usuario.id}
                    selecionados={usuario.papeis}
                  />
                }
              />

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <FormSenha usuarioId={usuario.id} />
                {usuario.id === eu?.id ? (
                  <p className="text-muted-foreground self-end text-xs">
                    A própria conta não pode ser desativada, nem perder o papel
                    de administração — é o que impede o projeto de ficar sem
                    ninguém que consiga entrar aqui.
                  </p>
                ) : (
                  <div className="self-end">
                    <FormAtivo
                      usuarioId={usuario.id}
                      ativo={usuario.ativo}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
