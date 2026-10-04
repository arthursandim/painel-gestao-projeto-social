// Foto do aluno e do item (fase 8).
//
// Uma foto vigente por registro, substituível, sem histórico. A foto do aluno
// NÃO entra na tabela de documentos: aquela lista é a trilha legal auditável,
// e foto é campo do cadastro.
//
// Bucket privado `fotos`. O navegador redimensiona antes de enviar, o servidor
// confere e grava num caminho fixo por registro, sobrescrevendo. A leitura é
// por URL assinada de vida curta. Puro, para o verifica-regras conferir.

export const BUCKET_FOTOS = "fotos";

/** Lado maior depois do redimensionamento, e a meta de peso (~150 kB). */
export const LADO_MAXIMO = 1024;
export const PESO_ALVO_BYTES = 200_000;
export const QUALIDADES_JPEG = [0.85, 0.75, 0.65, 0.55] as const;

/**
 * Teto do que o servidor aceita. A foto que sai do navegador tem ~150 kB; o
 * teto é folga para câmera de resolução alta, não convite a arquivo cru.
 */
export const TAMANHO_MAXIMO_BYTES = 1_000_000;

/** Vida da URL assinada de leitura, em segundos. A página gera uma nova a cada visita. */
export const VIDA_URL_FOTO = 300;

const MATRICULA = /^A\d{4,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Caminho da foto do aluno: pela matrícula, nunca pelo nome — nome de criança
 * em caminho de arquivo é dado pessoal exposto em log, URL e listagem de bucket
 * (a mesma regra da nomenclatura de documentos). O formato é conferido para que
 * nenhum valor estranho vire `../` dentro do bucket.
 */
export function caminhoFotoAluno(matricula: string): string {
  if (!MATRICULA.test(matricula)) throw new Error(`Matrícula inválida para caminho de foto: ${matricula}`);
  return `alunos/${matricula}.jpg`;
}

export function caminhoFotoItem(itemId: string): string {
  if (!UUID.test(itemId)) throw new Error(`Item inválido para caminho de foto: ${itemId}`);
  return `itens/${itemId.toLowerCase()}.jpg`;
}

/**
 * JPEG pela assinatura dos primeiros bytes (FF D8 FF), não pelo tipo que o
 * navegador declara: o tipo vem do cliente e pode dizer qualquer coisa.
 */
export function ehJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function erroDoArquivoDeFoto(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "Nenhuma foto recebida.";
  if (bytes.length > TAMANHO_MAXIMO_BYTES) return "Foto grande demais. Tente de novo — o app reduz a imagem antes de enviar.";
  if (!ehJpeg(bytes)) return "A foto precisa chegar em JPEG.";
  return null;
}

/**
 * Dimensões depois de reduzir o lado maior a `max`, mantendo a proporção.
 * Imagem menor que o limite não é ampliada.
 */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  max: number = LADO_MAXIMO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const escala = max / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}
