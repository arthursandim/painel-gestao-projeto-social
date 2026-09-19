/**
 * Valida um destino de redirecionamento vindo da URL.
 *
 * Sem isto, `/login?proximo=https://site-falso/` faria o app mandar a pessoa
 * para fora depois de um login bem-sucedido — com a credencial já digitada e a
 * aparência de que o próprio sistema levou até lá. É open redirect, e a hora de
 * tratar é agora, não quando aparecer.
 *
 * Só passa caminho relativo de barra única. `//host` é rejeitado porque o
 * navegador o lê como URL absoluta protocol-relative.
 */
export function rotaInternaSegura(
  destino: string | null | undefined,
  padrao = "/painel",
): string {
  if (!destino) return padrao;
  if (!destino.startsWith("/")) return padrao;
  if (destino.startsWith("//")) return padrao;
  if (destino.startsWith("/\\")) return padrao;
  return destino;
}
