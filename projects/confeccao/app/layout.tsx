import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SupabaseConfiguration } from "../components/supabase-configuration";
import { ClientApplicationProviders } from "../components/client-application-providers";
import "./globals.css";
import "../components/mobile-records.css";
import "../components/mobile.css";

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
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={poppins.variable}><SupabaseConfiguration url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""} publishableKey={(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "").startsWith("sb_publishable_") ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "") : ""}><ClientApplicationProviders>{children}</ClientApplicationProviders></SupabaseConfiguration></body>
    </html>
  );
}
