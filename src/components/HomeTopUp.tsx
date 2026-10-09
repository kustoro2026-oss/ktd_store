// Section "Top Up Game + Isi Saldo" di beranda — replika 1:1 struktur
// section top-up itemku.com/id/: dua kartu berdampingan (kolom flex),
// header dengan ikon + judul + tautan "Lihat Semua" (pill di desktop,
// teks polos di mobile), grid item 4/5 kolom berlatarkan #EAF2FC yang
// sudutnya hanya membulat di kanan-atas + kiri-bawah, dan strip "tiket"
// dekoratif di atas/bawah grid. Judul memakai Exo, label item Exo 2 —
// sama seperti tipografi itemku.
import Link from "next/link";
import { Exo, Exo_2 } from "next/font/google";
import type { ReactNode } from "react";
import { ChevronRight, Gamepad2, LayoutGrid, Wallet } from "lucide-react";
import { TOPUP_PROVIDERS, type TopUpProvider } from "@/lib/topup";
import ProviderLogo from "@/components/topup/ProviderLogo";

const exo = Exo({ subsets: ["latin"], weight: ["700"] });
const exo2 = Exo_2({ subsets: ["latin"], weight: ["400"] });

/** Biru tautan "Lihat Semua" — inline karena rule global `a { color: inherit }`
 *  (di luar layer) mengalahkan utility text-* di elemen anchor. */
const LINK_BLUE = { color: "#3B82F6" } as const;

/** Provider pilihan kartu game (urutan = urutan tampil). 9 brand + tile
 *  "Semua Game" = 10 item persis seperti grid itemku. */
const GAME_SLUGS = [
  "mobile-legends",
  "free-fire",
  "genshin-impact",
  "honkai-star-rail",
  "pubg-mobile",
  "valorant",
  "steam-wallet",
  "nintendo-eshop",
  "playstation",
];

/** Campuran e-wallet, pulsa operator, dan token listrik. */
const SALDO_SLUGS = [
  "dana",
  "ovo",
  "gopay",
  "shopeepay",
  "linkaja",
  "telkomsel",
  "tri",
  "indosat",
  "xl",
  "pln",
];

function pickSlugs(slugs: string[]): TopUpProvider[] {
  return slugs
    .map((s) => TOPUP_PROVIDERS.find((p) => p.slug === s))
    .filter((p): p is TopUpProvider => Boolean(p));
}

/** Strip "tepi tiket" 138×4 ala itemku — di atas grid rata kiri, di bawah
 *  grid rata kanan + diputar 180°. */
function TicketStrip({ flipped = false }: { flipped?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-full ${flipped ? "justify-end" : "justify-start"}`}
    >
      <svg
        width="138"
        height="4"
        viewBox="0 0 138 4"
        className={flipped ? "rotate-180" : undefined}
      >
        <path d="M0 0h134l4 2-4 2H0z" fill="#D9E2FC" />
      </svg>
    </div>
  );
}

/** Label item grid: Exo 2, 11px mobile / 14px desktop, abu #474747,
 *  maksimal 2 baris. */
function ItemLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className={`${exo2.className} line-clamp-2 text-center text-[11px] font-normal leading-[16.5px] text-[#474747] sm:text-sm sm:leading-[21px]`}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  href,
  icon,
  items,
  allTile,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  items: TopUpProvider[];
  /** Tile tambahan di akhir grid (mis. "Semua Game" → halaman kategori). */
  allTile?: { label: string; href: string };
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      {/* Header desktop: ikon dalam kotak 40×40 + judul 24px + pill. */}
      <div className="hidden items-center justify-between sm:flex">
        <div className="flex items-center gap-2">
          <span className="relative flex items-center justify-center p-2">
            <span className="relative z-10 flex h-6 w-6 items-center justify-center text-[#1B1B1B]">
              {icon}
            </span>
          </span>
          <h2 className={`${exo.className} text-2xl font-bold leading-9 text-[#1B1B1B]`}>
            {title}
          </h2>
        </div>
        <Link
          href={href}
          style={LINK_BLUE}
          className={`${exo.className} flex h-10 items-center gap-1 rounded-lg border border-[#307FE2] bg-[#EAF2FC]/25 px-3 text-sm font-bold transition-colors hover:bg-[#97BFF1]/30`}
        >
          Lihat Semua
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Header mobile: ikon 24×24 + judul 16px + teks Lihat Semua polos. */}
      <div className="flex items-center justify-between sm:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center text-[#222222]">
            {icon}
          </span>
          <h2 className={`${exo.className} text-base font-bold leading-6 text-[#222222]`}>
            {title}
          </h2>
        </div>
        <Link
          href={href}
          style={LINK_BLUE}
          className={`${exo.className} flex items-center gap-1 text-sm font-bold`}
        >
          Lihat Semua
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <TicketStrip />

      {/* Grid item — latar #EAF2FC, sudut hanya kanan-atas + kiri-bawah. */}
      <div className="grid h-full grid-cols-4 items-start justify-items-center gap-4 rounded-bl rounded-tr bg-[#EAF2FC] p-4 sm:grid-cols-5 sm:px-6">
        {items.map((p) => (
          <Link
            key={p.slug}
            href={`/topup/${p.slug}`}
            className="flex w-16 flex-col items-center gap-2 sm:w-[84px]"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden max-[340px]:h-14 max-[340px]:w-14 sm:h-[72px] sm:w-[72px]">
              <ProviderLogo slug={p.slug} label={p.label} className="h-full w-full" />
            </span>
            <ItemLabel>{p.label}</ItemLabel>
          </Link>
        ))}
        {allTile ? (
          <Link
            href={allTile.href}
            className="flex w-16 flex-col items-center gap-2 sm:w-[84px]"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center max-[340px]:h-14 max-[340px]:w-14 sm:h-[72px] sm:w-[72px]">
              <LayoutGrid className="h-8 w-8 text-[#307FE2] sm:h-9 sm:w-9" />
            </span>
            <ItemLabel>{allTile.label}</ItemLabel>
          </Link>
        ) : null}
      </div>

      <TicketStrip flipped />
    </div>
  );
}

export default function HomeTopUp() {
  const games = pickSlugs(GAME_SLUGS);
  const saldo = pickSlugs(SALDO_SLUGS);
  return (
    <section aria-label="Top Up Game dan Isi Saldo" className="container-site">
      <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2 sm:gap-6 sm:py-6">
        <SectionCard
          title="Top Up Game"
          href="/topup#kategori-game"
          icon={<Gamepad2 className="h-6 w-6" />}
          items={games}
          allTile={{ label: "Semua Game", href: "/topup#kategori-game" }}
        />
        <SectionCard
          title="Isi Saldo"
          href="/topup"
          icon={<Wallet className="h-6 w-6" />}
          items={saldo}
        />
      </div>
    </section>
  );
}
