import type { NextConfig } from "next";

/**
 * Hosts que podem abrir o `next dev` além de localhost.
 *
 * Só tem efeito em desenvolvimento. Sem isto, abrir o app pelo IP da rede —
 * que é como se testa no celular — carrega o HTML mas o Next bloqueia os
 * recursos de dev como cross-origin. O resultado é uma tela que parece certa e
 * não responde a toque nenhum: sem esses recursos os componentes de cliente
 * não hidratam, e sem hidratação não existe `onClick`. O menu recolhido foi o
 * primeiro a denunciar isso.
 *
 * A faixa 192.168.x.x cobre a rede doméstica sem prender um IP específico, que
 * vem por DHCP e muda a cada reconexão. `DEV_ORIGINS` acrescenta outros —
 * túnel, outra faixa de rede — separados por vírgula, em .env.local.
 */
const origensDeDesenvolvimento = [
  "192.168.*.*",
  ...(process.env.DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ??
    []),
];

const nextConfig: NextConfig = {
  // Sem isto, `next dev` anexa um bloco próprio ao CLAUDE.md a cada execução.
  // O CLAUDE.md deste repo é a especificação do projeto e não é gerado.
  agentRules: false,

  allowedDevOrigins: origensDeDesenvolvimento,

  experimental: {
    // Libera forbidden() e unauthorized() em next/navigation. É o que faz a
    // rota negada responder 403 de verdade, e não um 200 com tela vazia nem um
    // 404 que mentiria dizendo que a rota não existe.
    authInterrupts: true,
  },
};

export default nextConfig;
