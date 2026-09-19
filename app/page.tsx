import { redirect } from "next/navigation";

/** A raiz não tem conteúdo próprio: a tela inicial é o painel de pendências. */
export default function Home() {
  redirect("/painel");
}
