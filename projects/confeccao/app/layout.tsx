import type { Metadata } from "next";
import localFont from "next/font/local";
import { SupabaseConfiguration } from "../components/supabase-configuration";
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

export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={poppins.variable}><SupabaseConfiguration url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""} publishableKey={(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "").startsWith("sb_publishable_") ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "") : ""}><DemoProvider>{children}</DemoProvider></SupabaseConfiguration></body>
    </html>
  );
}
