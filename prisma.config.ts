// O Prisma CLI não carrega .env sozinho quando existe um arquivo de config, e o
// dotenv leria .env por padrão. O caminho é explícito para o CLI ler o mesmo
// .env.local que o Next.js lê — os segredos moram num arquivo só.
import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
