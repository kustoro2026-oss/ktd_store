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
