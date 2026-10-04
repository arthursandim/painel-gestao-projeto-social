"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (public/sw.js) SÓ em produção. Em desenvolvimento,
 * um service worker servindo versão antiga produz bug fantasma, caro de
 * diagnosticar (CLAUDE.md, seção PWA).
 *
 * Teste de capacidade, não de aparelho: navegador sem service worker
 * simplesmente não registra, e o app funciona igual.
 */
export function RegistroSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o app continua funcionando; só não instala.
    });
  }, []);
  return null;
}
