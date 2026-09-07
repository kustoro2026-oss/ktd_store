import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Semua Produk",
  description:
    "Jelajahi semua produk pilihan KTD Store. Filter berdasarkan kategori atau cari produk favorit Anda, lalu pesan mudah dan aman via WhatsApp.",
};

export default function ProdukLayout({ children }: LayoutProps<"/produk">) {
  return <>{children}</>;
}
