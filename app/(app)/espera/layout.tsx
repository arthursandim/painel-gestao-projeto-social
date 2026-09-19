import { exigirAcesso } from "@/lib/auth";

/** Guarda de papel do módulo. A lista permitida sai de lib/permissoes.ts. */
export default async function Layout({ children }: LayoutProps<"/espera">) {
  await exigirAcesso("/espera");
  return <>{children}</>;
}
