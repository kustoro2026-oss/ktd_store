import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import type { AnekaProduct } from "@/lib/anekadropship";
import { useCart } from "@/lib/cart";

function parseStock(stok: string): number {
  const n = parseInt(stok.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

export default function ProductCard({ p }: { p: AnekaProduct }) {
  const { hasItem, toggleItem } = useCart();
  const inCart = hasItem(p.id);
  const stock = parseStock(p.stok);
  const lowStock = stock > 0 && stock < 50;
  const price = p.rekomendasiJual || "Rp -";

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg">
      {/* Image */}
      <Link
        href={`/produk/${p.id}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-gray-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {lowStock && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Hampir Habis
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
          Lihat Detail
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        {/* Name — single line, ellipsis */}
        <Link
          href={`/produk/${p.id}`}
          title={p.name}
          className="truncate text-sm font-medium leading-snug text-ink transition-colors hover:text-brand"
        >
          {p.name}
        </Link>

        {/* Price */}
        <div className="mt-2 text-lg font-bold text-brand">{price}</div>

        {/* Sold */}
        <div className="mt-1 text-xs text-muted-2">{p.terjual || "0"} terjual</div>

        {/* CTA */}
        <div className="mt-auto flex gap-2 pt-3">
          <button
            type="button"
            onClick={() => toggleItem({ id: p.id, name: p.name, image: p.image, price })}
            aria-label={inCart ? "Hapus dari Keranjang" : "Masukkan Keranjang"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              inCart
                ? "border-brand bg-brand text-white"
                : "border-gray-200 text-ink hover:border-brand hover:text-brand"
            }`}
          >
            {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </button>
          <Link
            href={`/produk/${p.id}`}
            className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-brand py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
          >
            Lihat Detail
          </Link>
        </div>
      </div>
    </div>
  );
}
