import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TR CoffeeDB — Türkiye'de Nitelikli Kahve Keşfi",
    template: "%s | TR CoffeeDB",
  },
  description:
    "Türkiye'nin önde gelen kavurucularındaki nitelikli kahveleri karşılaştırın ve keşfedin. Köken, işleme yöntemi, kavurma seviyesi ve tada göre filtreleyin. Satın alma işlemleri doğrudan kavuruculara gider.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white font-sans text-stone-900">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
