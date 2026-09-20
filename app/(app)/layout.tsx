import { Cabecalho } from "@/components/cabecalho";
import { exigirUsuario } from "@/lib/auth";
import { modulosVisiveis, ROTULO_PAPEL } from "@/lib/permissoes";

/**
 * Shell das telas internas. Garante sessão; o papel é conferido no layout de
 * cada módulo, que sabe qual rota é a sua.
 *
 * O menu é montado a partir do mesmo mapa que os guardas consultam, então não
 * aparece aqui link para tela que o servidor barraria depois.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await exigirUsuario();

  return (
    <>
      <Cabecalho
        nome={usuario.nome}
        papeis={usuario.papeis.map((p) => ROTULO_PAPEL[p])}
        itens={modulosVisiveis(usuario.papeis).map((m) => ({
          rota: m.rota,
          titulo: m.titulo,
        }))}
      />
      {/* Na impressão o container some: a ficha se mede em milímetros de A4 e
          não pode herdar largura máxima nem respiro de tela. */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">
        {children}
      </div>
    </>
  );
}
