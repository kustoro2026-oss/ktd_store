// Logo provider top-up: gambar lokal bila ada, kalau tidak fallback inisial
// brand dengan warna solid (deterministik dari label).
import { providerImage } from "@/lib/topup-images";

const PALETTE = [
  "bg-[#8a2f1d]",
  "bg-[#1d3f8a]",
  "bg-[#0f6e4f]",
  "bg-[#7a5c10]",
  "bg-[#5b2178]",
  "bg-[#0d5e6b]",
  "bg-[#8a1d5e]",
  "bg-[#3c3c7a]",
];

/** Inisial brand untuk fallback tile: "Free Fire" → "FF", "by.U" → "B". */
export function initialsFor(label: string): string {
  const words = label
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Warna tile deterministik dari label brand. */
export function tileColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Props = {
  slug: string;
  label: string;
  className?: string;
};

export default function ProviderLogo({ slug, label, className = "" }: Props) {
  const src = providerImage(slug);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        loading="lazy"
        className={`object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex select-none items-center justify-center font-bold text-white ${tileColor(label)} ${className}`}
    >
      {initialsFor(label)}
    </span>
  );
}
