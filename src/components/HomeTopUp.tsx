// Section "Top Up Game + Isi Saldo" di beranda (pola homepage jasa top-up
// profesional): dua kartu berdampingan, masing-masing berisi 10 logo brand
// pilihan (2 baris × 5 kolom) dengan tombol "Lihat Semua" ke halaman /topup.
// Data seluruhnya statis dari src/lib/topup.ts — komponen server murni,
// tanpa fetch maupun JS klien tambahan.
import Link from "next/link";
import { ArrowRight, Gamepad2, Wallet } from "lucide-react";
import { TOPUP_PROVIDERS, type TopUpProvider } from "@/lib/topup";
import ProviderLogo from "@/components/topup/ProviderLogo";

/** Provider pilihan tiap kartu (urutan = urutan tampil). */
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
  "xbox",
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

function TopUpTileCard({
  title,
  desc,
  href,
  icon,
  items,
}: {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  items: TopUpProvider[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:h-10 sm:w-10">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-ink max-[360px]:text-sm sm:text-lg">{title}</h3>
            <p className="hidden truncate text-xs text-muted sm:block">{desc}</p>
          </div>
        </div>
        <Link
          href={href}
          aria-label={`Lihat semua ${title}`}
          className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-bold text-brand transition-colors hover:bg-brand/5 sm:px-2 sm:text-sm"
        >
          <span className="max-[360px]:hidden">Lihat Semua</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Grid logo — bisa digeser horizontal di layar sangat sempit agar
          logo tetap berukuran wajar, bukan menyusut tak terbaca. */}
      <div className="mt-4 overflow-x-auto scrollbar-hide">
        <div className="grid min-w-[248px] grid-cols-5 gap-1.5 sm:gap-2">
          {items.map((p) => (
            <Link
              key={p.slug}
              href={`/topup/${p.slug}`}
              className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-gray-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-gray-100 transition-all group-hover:scale-105 group-hover:ring-brand/30 sm:h-13 sm:w-13">
                <ProviderLogo slug={p.slug} label={p.label} className="h-7 w-7 sm:h-8 sm:w-8" />
              </span>
              <span className="w-full truncate text-[10px] font-semibold text-ink sm:text-[11px]">
                {p.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeTopUp() {
  const games = pickSlugs(GAME_SLUGS);
  const saldo = pickSlugs(SALDO_SLUGS);
  return (
    <section className="container-site mt-8">
      <h2 className="sr-only">Top Up Game dan Isi Saldo</h2>
      <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-sky-50/70 via-gray-50 to-transparent p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopUpTileCard
            title="Top Up Game"
            desc="Diamond & voucher game favorit"
            href="/topup#kategori-game"
            icon={<Gamepad2 className="h-5 w-5" />}
            items={games}
          />
          <TopUpTileCard
            title="Isi Saldo"
            desc="E-wallet, pulsa, & token listrik"
            href="/topup"
            icon={<Wallet className="h-5 w-5" />}
            items={saldo}
          />
        </div>
      </div>
    </section>
  );
}
