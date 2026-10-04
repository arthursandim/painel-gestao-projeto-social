import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Mantém o projeto Supabase acordado.
 *
 * No plano gratuito, o Supabase pausa o projeto depois de 7 dias sem
 * atividade — num recesso, o app voltaria fora do ar. O cron da Vercel
 * (vercel.json) chama esta rota uma vez por dia, e ela faz uma consulta mínima
 * ao banco. Não lê nem grava dado de ninguém.
 *
 * Fica fora do login (proxy.ts): o cron não tem sessão. Quem protege é o
 * CRON_SECRET, que a Vercel manda sozinha no cabeçalho Authorization das
 * chamadas do cron. Sem o segredo configurado, a rota recusa sempre — nunca
 * fica aberta por esquecimento.
 */
export const dynamic = "force-dynamic";

function autorizado(cabecalho: string | null): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  // Comparação em tempo constante: a resposta não pode vazar, pelo tempo,
  // quantos caracteres do segredo alguém já acertou.
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;
  return Response.json({ ok: true, em: new Date().toISOString() });
}
