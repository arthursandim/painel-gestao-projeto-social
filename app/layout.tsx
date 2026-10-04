import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { RegistroSw } from "@/components/registro-sw";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Engenho Cidadão",
  description: "Gestão do Projeto Social Engenho Cidadão — Equipe Sul Tucujú",
};

// Cor da barra do sistema no app instalado, a mesma do manifesto.
export const viewport: Viewport = {
  themeColor: "#16130F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistroSw />
      </body>
    </html>
  );
}
