import type { MarketplaceKey } from "@/lib/config";

/** Official marketplace logos (downloaded from Wikimedia Commons).
 * "color" = brand-colored logo for light backgrounds.
 * "white" = monochrome white logo for brand-colored buttons. */
const LOGOS: Record<MarketplaceKey, { color: string; white: string }> = {
  shopee: {
    color: "/images/marketplace/shopee.svg",
    white: "/images/marketplace/white/shopee.svg",
  },
  tiktok: {
    color: "/images/marketplace/tiktok.svg",
    white: "/images/marketplace/white/tiktok.svg",
  },
  lazada: {
    color: "/images/marketplace/lazada.svg",
    white: "/images/marketplace/white/lazada.svg",
  },
};

type Props = {
  name: MarketplaceKey;
  className?: string;
  variant?: "color" | "white";
};

/** Real marketplace logos used on marketplace order buttons. */
export default function MarketplaceIcon({ name, className = "h-5 w-auto", variant = "color" }: Props) {
  const src = LOGOS[name]?.[variant];
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden="true" className={className} />;
}
