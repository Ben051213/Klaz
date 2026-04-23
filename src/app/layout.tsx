import type { Metadata } from "next"
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// Klaz typography — Inter for UI, Fraunces for display titles, JetBrains
// Mono for labels/timecodes/join codes. Fraunces picked over Instrument
// Serif because its SOFT axis rounds terminals and its optical sizing
// softens large display sizes — less editorial/sharp, more warm.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  // SOFT rounds the terminals; opsz lets large sizes read as softer and
  // more editorial instead of the sharp small-text default.
  axes: ["SOFT", "opsz"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Klaz — an AI tutor your students trust",
  description:
    "Klaz is a classroom tutor scoped to your lessons. Students ask without fear. You see every question, every misconception, in real time.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-klaz-bg text-klaz-ink">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
