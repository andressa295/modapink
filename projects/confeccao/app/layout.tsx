import type { Metadata } from "next";
import localFont from "next/font/local";
import { DemoProvider } from "../lib/demo-store";
import "./globals.css";

const poppins = localFont({ src: [
  { path: "../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
  { path: "../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
  { path: "../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
  { path: "../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: "Moda Pink · Gestão da Confecção",
  description: "Do tecido à peça pronta. Produção, materiais, fichas técnicas e qualidade.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={poppins.variable}><DemoProvider>{children}</DemoProvider></body>
    </html>
  );
}
