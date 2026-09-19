import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem isto, `next dev` anexa um bloco próprio ao CLAUDE.md a cada execução.
  // O CLAUDE.md deste repo é a especificação do projeto e não é gerado.
  agentRules: false,

  experimental: {
    // Libera forbidden() e unauthorized() em next/navigation. É o que faz a
    // rota negada responder 403 de verdade, e não um 200 com tela vazia nem um
    // 404 que mentiria dizendo que a rota não existe.
    authInterrupts: true,
  },
};

export default nextConfig;
