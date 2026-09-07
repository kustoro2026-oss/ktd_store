import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keranjang",
  description: "Keranjang belanja Anda di KTD Store.",
  // Cart state is per-visitor — never let search engines index it.
  robots: { index: false, follow: false },
};

export default function KeranjangLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
