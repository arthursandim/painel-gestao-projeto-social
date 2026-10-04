import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA (servido em /manifest.webmanifest). Valores do CLAUDE.md,
 * seção PWA. Os ícones saem de `npm run pwa:icones`.
 *
 * Fica fora do proxy de login (proxy.ts): o navegador busca o manifesto sem
 * cookie, e um redirecionamento para /login deixaria o app sem instalação.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Engenho Cidadão",
    short_name: "Engenho",
    description: "Gestão do Projeto Social Engenho Cidadão — Equipe Sul Tucujú",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#16130F",
    background_color: "#F5F3EF",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
