"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * O F5 volta a tela ao estado inicial (decisão de 2026-10-27).
 *
 * Duas fontes trazem de volta o que foi digitado:
 *
 * - O navegador: alguns (Firefox) restauram os campos de formulário no
 *   recarregamento. O `reset()` devolve cada campo ao valor que o servidor
 *   renderizou — numa edição, os dados salvos; num cadastro, o formulário vazio.
 * - O endereço: busca, filtros e ordem das listas moram na URL, e o F5 recarrega
 *   a mesma URL. Nas telas abaixo a URL volta à raiz. Só nelas, por caminho
 *   exato: em `/alunos/novo?espera=…` e `/login?proximo=…` o parâmetro é
 *   contexto, não filtro, e perder seria pior que manter.
 */
const LISTAS_COM_FILTRO_NA_URL = new Set([
  "/alunos",
  "/chamada",
  "/chamada/historico",
  "/espera",
  "/inventario",
  "/inventario/emprestimos",
  "/config/historico",
]);

export function LimparAoRecarregar() {
  const caminho = usePathname();
  const router = useRouter();

  useEffect(() => {
    const navegacao = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navegacao?.type !== "reload") return;

    document.querySelectorAll("form").forEach((form) => form.reset());

    if (LISTAS_COM_FILTRO_NA_URL.has(caminho) && window.location.search) {
      router.replace(caminho);
    }
    // Só na montagem: o tipo de navegação é o do carregamento da página, e as
    // navegações seguintes, pelo próprio app, não são recarregamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
