import "server-only";

import { BUCKET_FOTOS, erroDoArquivoDeFoto, VIDA_URL_FOTO } from "@/lib/fotos";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Grava a foto no caminho fixo do registro, sobrescrevendo a anterior — uma
 * foto vigente, sem histórico. Quem chama já conferiu papel e arquivo.
 */
export async function gravarFoto(caminho: string, bytes: Uint8Array): Promise<string | null> {
  const { error } = await criarClienteAdmin()
    .storage.from(BUCKET_FOTOS)
    .upload(caminho, bytes, {
      contentType: "image/jpeg",
      upsert: true,
      // Cache curto: o caminho é o mesmo depois da troca, e a foto nova tem
      // que aparecer na próxima visita, não daqui a uma hora.
      cacheControl: "60",
    });
  return error ? error.message : null;
}

/**
 * URL assinada de leitura, de vida curta, gerada por pedido. Sem caminho, ou
 * se o Storage falhar, devolve null e a tela mostra o quadro vazio — foto que
 * não carrega não pode derrubar a página do aluno.
 */
export async function urlDaFoto(caminho: string | null | undefined): Promise<string | null> {
  if (!caminho) return null;
  const { data, error } = await criarClienteAdmin()
    .storage.from(BUCKET_FOTOS)
    .createSignedUrl(caminho, VIDA_URL_FOTO);
  return error ? null : data.signedUrl;
}

/**
 * Lê e confere o arquivo `foto` do formulário: tamanho e assinatura JPEG,
 * pelos bytes — o tipo declarado pelo navegador não vale como prova.
 */
export async function lerFotoDoForm(
  form: FormData,
): Promise<{ bytes: Uint8Array } | { erro: string }> {
  const arquivo = form.get("foto");
  if (!(arquivo instanceof File)) return { erro: "Nenhuma foto recebida." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const erro = erroDoArquivoDeFoto(bytes);
  return erro ? { erro } : { bytes };
}
