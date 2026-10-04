// Service worker do Engenho Cidadão. Registrado SÓ em produção
// (components/registro-sw.tsx); em desenvolvimento, cache de versão antiga
// produz bug fantasma.
//
// Regras do CLAUDE.md, seção PWA:
// - rede primeiro para tudo; cache só como último recurso;
// - NUNCA guardar dado de aluno, documento ou foto;
// - cache versionado, com limpeza dos antigos na ativação.
//
// Na prática, só três coisas passam por aqui:
// - navegação (abrir uma página): sempre da rede, nunca guardada — o HTML tem
//   dado de aluno. Sem rede, a página fixa /offline.html;
// - arquivos estáticos do próprio app (/_next/static, /icones, logos): rede
//   primeiro, e a cópia guardada só se a rede falhar. Não têm dado de ninguém;
// - todo o resto (POST, Server Actions, pedidos RSC do Next, fotos no
//   Supabase, ViaCEP) não é interceptado: segue direto para a rede.
//
// Mudou este arquivo? Incremente VERSAO: o navegador instala o novo e a
// ativação apaga os caches das versões anteriores.

const VERSAO = "v1";
const CACHE = `engenho-${VERSAO}`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icones/icone-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome.startsWith("engenho-") && nome !== CACHE)
            .map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Arquivo estático do próprio app: sem dado de aluno, pode ter cópia. */
function ehEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icones/") ||
    /^\/logo-(projeto|equipe)[\w-]*\.png$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  // Outro domínio (fotos no Supabase, ViaCEP): nunca interceptado.
  if (url.origin !== self.location.origin) return;

  if (pedido.mode === "navigate") {
    // Página: só da rede. Nada é guardado.
    evento.respondWith(fetch(pedido).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (ehEstatico(url)) {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            evento.waitUntil(caches.open(CACHE).then((cache) => cache.put(pedido, copia)));
          }
          return resposta;
        })
        .catch(() => caches.match(pedido).then((guardada) => guardada ?? Response.error())),
    );
  }
  // Qualquer outra coisa: sem respondWith, o navegador segue sozinho.
});
