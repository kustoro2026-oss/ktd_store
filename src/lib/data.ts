// Static editorial content for the homepage (non-product sections).
// Product + category data now comes from anekadropship.id via /api routes.
// Blog posts imported from blog-posts.ts (30+ SEO-optimized articles).

import blogPostsData from "./blog-posts";

export type IconKey =
  | "spray"
  | "paw"
  | "sparkles"
  | "home"
  | "party"
  | "cooking"
  | "flashlight"
  | "fish"
  | "tent"
  | "coffee"
  | "mic"
  | "gift";

export const collections: { title: string; icon: IconKey; query: string }[] = [
  { title: "Pembersih & Desinfektan", icon: "spray", query: "pembersih" },
  { title: "Perawatan Hewan", icon: "paw", query: "hewan" },
  { title: "Kecantikan & Perawatan", icon: "sparkles", query: "kecantikan" },
  { title: "Alat Rumah Tangga", icon: "home", query: "rumah tangga" },
];

export type BlogPost = {
  title: string;
  slug: string;
  icon: IconKey;
  date: string;
  query: string;
  image: string;
  excerpt: string;
  content: string[];
};

/** 30+ artikel SEO untuk long-tail keyword targeting. */
export const blogPosts: BlogPost[] = blogPostsData;

/** Pemetaan artikel → slug kategori situs (internal link CTA di halaman artikel). */
export const blogCategorySlug: Record<string, string> = {
  "peralatan-rumah-tangga-wajib-hunian-minimalis": "Alat Rumah Tangga",
  "alat-kebersihan-rumah-paling-efektif": "Alat Rumah Tangga",
  "suplemen-pengemuk-ikan-terbaik-budidaya": "Peternakan",
  "vitamin-suplemen-hewan-peliharaan-kucing-anjing": "Perawatan Hewan",
  "skincare-routine-lengkap-kulit-glowing": "Kecantikan",
  "parfum-wanita-tahan-lama-terbaik": "wewangian atau kosmetik dan perawatan",
  "suplemen-herbal-alami-daya-tahan-tubuh": "Herbal",
  "alat-kesehatan-rumah-tangga-wajib-dimiliki": "Kesehatan",
  "gadget-elektronik-rumah-tangga-paling-berguna": "ELEKTRONIK",
  "sepatu-wanita-flat-nyaman-kerja-jalan": "Sepatu wanita",
  "aksesoris-fashion-wanita-wajib-dimiliki": "AKSESORIS",
  "makanan-minuman-sehat-gaya-hidup-aktif": "Makanan & Minuman",
  "mainan-edukasi-anak-terbaik-belajar-bermain": "MAINAN",
  "hobi-kreatif-di-rumah-bisa-jadi-cuan": "Hobi",
  "spare-part-motor-paling-sering-diganti": "SparePart",
  "aksesoris-motor-fungsional-wajib-dipasang": "Otomotif",
  "pupuk-nutrisi-tanaman-terbaik-suburkan-kebun": "Pupuk Organik",
  "pestisida-pembasmi-hama-tanaman-lindungi-kebun": "Pembasmi Serangga",
  "desinfektan-rumah-tangga-efektif-bunuh-kuman": "Desinfektan Rumah dan Kandang",
};

/** Look up a single blog post by its slug (for the article pages). */
export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((b) => b.slug === slug);
}

export const heroSlides: { title: string; subtitle: string; icon: IconKey; image: string }[] = [
  { title: "", subtitle: "", icon: "home", image: "/images/hero/1.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/2.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/3.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/4.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/5.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/6.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/7.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/8.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/9.webp" },
  { title: "", subtitle: "", icon: "home", image: "/images/hero/10.webp" },
];

export const recentSearches = ["Powerbank", "Lampu LED", "Pembersih", "Kesehatan"];
