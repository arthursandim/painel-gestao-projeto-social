import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem isto, `next dev` anexa um bloco próprio ao CLAUDE.md a cada execução.
  // O CLAUDE.md deste repo é a especificação do projeto e não é gerado.
  agentRules: false,
};

export default nextConfig;
