import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart";
import { SITE_URL } from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KTD Store — Belanja Online Produk Pilihan",
    template: "%s | KTD Store",
  },
  description:
    "KTD Store adalah toko online produk pilihan langsung dari supplier. Pesan mudah dan aman via WhatsApp.",
  keywords: [
    "KTD Store",
    "belanja online",
    "toko online",
    "produk pilihan",
    "dropship Indonesia",
    "pesan via WhatsApp",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "KTD Store",
    title: "KTD Store — Belanja Online Produk Pilihan",
    description:
      "Produk pilihan langsung dari supplier. Pesan mudah dan aman via WhatsApp.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
  },
  twitter: {
    card: "summary",
    title: "KTD Store — Belanja Online Produk Pilihan",
    description:
      "Produk pilihan langsung dari supplier. Pesan mudah dan aman via WhatsApp.",
    images: ["/images/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
    other: [{ rel: "manifest", url: "/site.webmanifest" }],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "KTD Store",
  url: SITE_URL,
  description:
    "KTD Store adalah toko online produk pilihan langsung dari supplier.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/produk?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "KTD Store",
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
