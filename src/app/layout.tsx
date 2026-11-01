import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/brand";
import { SITE_CARD } from "@/lib/page-metadata";
import { Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/site";
import { CompareDock } from "@/components/coffee/compare-controls";
import { WebAnalytics } from "@/components/v2/web-analytics";
import { CONSENT_COOKIE } from "../../shared/v2/consent";
import "./globals.css";

// Text and headings use the system font (Basalt design language); Geist Mono is the only web font, with latin-ext for ç ğ ı İ ö ş ü.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Phone status bar in the page ground colour (--color-ground), so it runs into the sticky header.
// viewport-fit=cover: the page owns the status-bar strip, and the header, menu and bottom bars pad by env(safe-area-inset-*),
// so on iPhone a sticky header never slides under the status bar where a tap scrolls to the top instead.
export const viewport: Viewport = {
  themeColor: '#f7f8f6',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  applicationName: SITE_NAME,
  // iPhone Safari must not turn prices, sizes or dates into tel:/mail links: the rewritten markup breaks hydration.
  formatDetection: { telephone: false, address: false, email: false },
  title: {
    default: brand.title,
    template: `%s | ${brand.name}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: brand.title,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'tr_TR',
    type: 'website',
    images: [SITE_CARD],
  },
  twitter: {
    card: 'summary_large_image',
    title: brand.title,
    description: SITE_DESCRIPTION,
    images: [SITE_CARD],
  },
  robots: {
    index: brand.production,
    follow: brand.production,
    googleBot: {
      index: brand.production,
      follow: brand.production,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

// Runs before the body paints: a stored choice hides the consent banner until React hydrates.
const consentScript = `if(/(?:^|; )${CONSENT_COOKIE}=(?:essential|analytics)(?:;|$)/.test(document.cookie))document.documentElement.dataset.consent="1"`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ground font-sans text-ink">
        <script dangerouslySetInnerHTML={{ __html: consentScript }} />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:p-4">İçeriğe geç</a>
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <CompareDock />
        <Footer />
        <WebAnalytics />
      </body>
    </html>
  );
}
