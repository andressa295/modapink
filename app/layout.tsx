import type { Metadata } from "next"

import { Poppins } from "next/font/google"

import "./globals.css"

const poppins = Poppins({

  subsets: ["latin"],

  weight: [

    "300",

    "400",

    "500",

    "600",

    "700"

  ],

  display: "swap",

  variable: "--font-poppins"
})

export const metadata: Metadata = {

  metadataBase:
    new URL("https://modapink.phand.com.br"),

  title: "Moda Pink",

  description:
    "Escolha suas peças e monte seu pedido na Moda Pink.",

  openGraph: {
    title:
      "Catálogo Moda Pink",
    description:
      "Escolha suas peças, cores e tamanhos e finalize seu pedido.",
    siteName:
      "Moda Pink",
    type:
      "website",
    images: [
      {
        url:
          "/modapiink.png",
        width:
          820,
        height:
          503,
        alt:
          "Moda Pink"
      }
    ]
  },

  twitter: {
    card:
      "summary_large_image",
    title:
      "Catálogo Moda Pink",
    description:
      "Escolha suas peças, cores e tamanhos e finalize seu pedido.",
    images: [
      "/modapiink.png"
    ]
  }
}

export default function RootLayout({

  children,

}: {

  children: React.ReactNode

}) {

  return (

    <html

      lang="pt-BR"

      suppressHydrationWarning

    >

      <body

        className={`

          ${poppins.className}

          ${poppins.variable}

        `}

      >

        {children}

      </body>

    </html>
  )
}
