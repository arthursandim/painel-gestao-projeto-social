/**
 * Ícones do PWA a partir de public/logo-projeto.png.
 *
 *   npm run pwa:icones
 *
 * Gera em public/icones/: 192 e 512 ("any") e 192 e 512 "maskable", mais
 * app/apple-icon.png (180, tela inicial do iPhone). Rodar de novo quando o
 * logotipo mudar; a saída é versionada junto do código.
 *
 * Fundo claro (#F5F3EF, o `background_color` do manifesto): a engrenagem é
 * preta e sumiria num lançador escuro com fundo transparente.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ORIGEM = path.join("public", "logo-projeto.png");
const DESTINO = path.join("public", "icones");
const FUNDO = "#F5F3EF";

/**
 * `ocupacao` é a fração do lado que o logo ocupa. O maskable fica em 60%: o
 * Android recorta o ícone em círculo, gota ou quadrado, e só os 80% centrais
 * (zona segura) aparecem sempre — a engrenagem tem dentes até a borda.
 */
async function gerar(arquivo: string, lado: number, ocupacao: number) {
  const logo = Math.round(lado * ocupacao);
  const imagem = await sharp(ORIGEM)
    .resize(logo, logo, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FUNDO } })
    .composite([{ input: imagem, gravity: "center" }])
    .png()
    .toFile(arquivo);
  console.log(`  ${arquivo} (${lado}×${lado}, logo em ${Math.round(ocupacao * 100)}%)`);
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  await gerar(path.join(DESTINO, "icone-192.png"), 192, 0.84);
  await gerar(path.join(DESTINO, "icone-512.png"), 512, 0.84);
  await gerar(path.join(DESTINO, "icone-maskable-192.png"), 192, 0.6);
  await gerar(path.join(DESTINO, "icone-maskable-512.png"), 512, 0.6);
  await gerar(path.join("app", "apple-icon.png"), 180, 0.8);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
