import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { anekaClient } from "@/lib/anekadropship";

// Alat sinkronisasi gambar produk: mengunduh semua gambar dari anekadropship.id
// ke /public/images/products/ dan menulis src/lib/product-images.json (mapping
// id produk -> path lokal). Hanya berjalan di development (dijalankan manual
// lewat POST /api/admin/sync-images). Di production route ini menolak request.
// Jalankan ulang secara berkala agar produk baru ikut tersinkron.

export const dynamic = "force-dynamic";

const BASE = "https://anekadropship.id";
const OUT_DIR = path.join(process.cwd(), "public", "images", "products");
const MAPPING_PATH = path.join(process.cwd(), "src", "lib", "product-images.json");
const MAX_PAGES = 200;

/** Pastikan URL absolut. */
function absUrl(u: string): string {
  if (/^https?:\/\//i.test(u)) return u;
  return BASE + (u.startsWith("/") ? u : `/${u}`);
}

/** Ekstensi file dari URL, dengan fallback aman. */
function extOf(url: string): string {
  const m = url.split("?")[0].toLowerCase().match(/\.(webp|png|jpe?g|gif|avif)$/);
  return m ? (m[1] === "jpeg" ? "jpg" : m[1]) : "jpg";
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("empty body");
  await fs.writeFile(dest, buf);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).size > 0;
  } catch {
    return false;
  }
}

async function loadMapping(): Promise<Record<string, string[]>> {
  try {
    return JSON.parse(await fs.readFile(MAPPING_PATH, "utf8"));
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kumpulkan semua produk unik dari listing (home + terbaru) sampai halaman kosong. */
async function collectProducts(): Promise<{ id: string; image: string }[]> {
  const map = new Map<string, string>();

  const walk = async (
    fetchPage: (page: number) => Promise<{ image: string; id: string }[]>
  ) => {
    for (let p = 1; p <= MAX_PAGES; p++) {
      const items = await fetchPage(p);
      if (!items.length) break;
      for (const it of items) {
        if (!map.has(it.id) && it.image) map.set(it.id, it.image);
      }
      // Jeda antar halaman agar tidak kena throttle upstream.
      await sleep(400);
    }
  };

  await walk(async (page) => {
    const { products } = await anekaClient.getProducts({ page });
    return products.map((p) => ({ id: p.id, image: p.image }));
  });

  // Listing "terbaru" kadang ditolak setelah banyak request — jangan
  // gagalkan seluruh sinkronisasi; lanjut saja dengan produk dari listing utama.
  try {
    anekaClient.resetSession();
    await walk(async (page) => {
      const { products } = await anekaClient.getNewestProducts({ page });
      return products.map((p) => ({ id: p.id, image: p.image }));
    });
  } catch {
    // Abaikan — produk dari listing utama sudah cukup.
  }

  return Array.from(map.entries()).map(([id, image]) => ({ id, image }));
}

/** Jalankan tugas dengan concurrency terbatas. */
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Hanya tersedia di development" }, { status: 403 });
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const mapping = await loadMapping();

  // 1) Kumpulkan produk dari semua halaman listing.
  const products = await collectProducts();

  // 2) Untuk tiap produk: ambil galeri detail lalu unduh gambarnya.
  let newImages = 0;
  let skipped = 0;
  let failedProducts = 0;

  await runPool(products, 4, async ({ id, image }) => {
    try {
      // Produk yang sudah tersinkron lengkap dilewati (resumable).
      const existing = mapping[id];
      if (
        existing?.length &&
        (await fileExists(path.join(process.cwd(), "public", existing[0])))
      ) {
        skipped++;
        return;
      }

      let urls: string[] = [];
      try {
        const detail = await anekaClient.getProductDetail(id);
        urls = detail.images.filter(Boolean);
      } catch {
        // Detail gagal (produk dihapus/berubah) — pakai gambar utama dari kartu.
      }
      if (!urls.length && image) urls = [image];

      const seen = new Set<string>();
      const local: string[] = [];
      let i = 0;
      for (const u of urls) {
        const abs = absUrl(u);
        if (seen.has(abs)) continue;
        seen.add(abs);
        const file = `${id}-${i}.${extOf(abs)}`;
        const dest = path.join(OUT_DIR, file);
        i++;
        if (await fileExists(dest)) {
          local.push(`/images/products/${file}`);
          continue;
        }
        try {
          await downloadFile(abs, dest);
          local.push(`/images/products/${file}`);
          newImages++;
        } catch {
          // Lewati gambar yang gagal; fallback ke URL asli di sisi render.
        }
      }

      mapping[id] = local;
    } catch {
      failedProducts++;
    }
  });

  // 3) Simpan mapping (urutkan kunci agar diff rapi).
  const sorted: Record<string, string[]> = {};
  for (const k of Object.keys(mapping).sort((a, b) => Number(a) - Number(b))) {
    sorted[k] = mapping[k];
  }
  await fs.writeFile(MAPPING_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  return NextResponse.json({
    ok: true,
    totalProducts: products.length,
    mappedProducts: Object.keys(mapping).filter((k) => mapping[k].length).length,
    newImages,
    skipped,
    failedProducts,
  });
}
