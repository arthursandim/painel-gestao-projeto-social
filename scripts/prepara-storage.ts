/**
 * Prepara o Supabase Storage: cria o bucket privado `fotos` ou, se já existe,
 * garante que continua privado e com as restrições de tipo e tamanho.
 *
 *   npm run storage:preparar
 *
 * Idempotente: rodar duas vezes não muda nada. Não apaga nem lista arquivos.
 * O bucket de documentos é da fase 5 e não é criado aqui.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";

import { BUCKET_FOTOS, TAMANHO_MAXIMO_BYTES } from "../lib/fotos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.");
  process.exit(1);
}

const supabase = createClient(url, chave, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Privado: nada sai sem URL assinada. Só JPEG, porque o navegador sempre
// converte antes de enviar; o teto repete o do servidor.
const opcoes = {
  public: false,
  allowedMimeTypes: ["image/jpeg"],
  fileSizeLimit: TAMANHO_MAXIMO_BYTES,
};

async function main() {
  const { data: existente } = await supabase.storage.getBucket(BUCKET_FOTOS);

  if (existente) {
    const { error } = await supabase.storage.updateBucket(BUCKET_FOTOS, opcoes);
    if (error) throw error;
    console.log(`Bucket "${BUCKET_FOTOS}" já existia — conferido: privado, só JPEG, até ${TAMANHO_MAXIMO_BYTES} bytes.`);
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET_FOTOS, opcoes);
    if (error) throw error;
    console.log(`Bucket "${BUCKET_FOTOS}" criado: privado, só JPEG, até ${TAMANHO_MAXIMO_BYTES} bytes.`);
  }

  const { data: conferido, error } = await supabase.storage.getBucket(BUCKET_FOTOS);
  if (error || !conferido) throw error ?? new Error("Bucket não encontrado depois de criado.");
  if (conferido.public) {
    console.error(`FALHA: o bucket "${BUCKET_FOTOS}" está público.`);
    process.exit(1);
  }
  console.log(`Confirmado no Supabase: public = ${conferido.public}.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
