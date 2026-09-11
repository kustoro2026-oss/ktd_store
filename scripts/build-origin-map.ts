// Bangun peta origin per produk (lokasi seller anekadropship -> kecamatan
// KiriminAja) untuk ongkir per-seller.
//
// Langkah:
//   1. Baca id+location produk dari tiktok-export/products.json.
//   2. Scrape alamat seller (data-address) dari halaman detail tiap produk
//      (hasil di-cache di tiktok-export/seller-addresses.json).
//   3. Cocokkan alamat ke kota + kecamatan KiriminAja (Mitra API sandbox).
//   4. Tulis src/lib/seller-origins.json (byProductId / byAddress / byLocation).
//
// Jalankan: npx tsx scripts/build-origin-map.ts
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Load .env.local secara manual (hindari ekspansi $ oleh dotenv) ────────
for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    process.env[m[1]] = m[2]
      .replace(/^["']|["']$/g, "")
      .replace(/\\\$/g, "$")
      .trim();
  }
}

type ProductRow = { id: string; name?: string; location?: string };
type CityEntry = { id: number | string; name: string; provinceId: number | string };
type DistrictEntry = { id: number | string; name: string };

/** Lowercase, buang tanda baca, satukan spasi. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Buang prefiks "kota/kab/kec" dari nama wilayah. */
function stripPrefix(s: string): string {
  return s
    .replace(/^kota\s+/, "")
    .replace(/^kab\s+/, "")
    .replace(/^kec\s+/, "");
}

/** Apakah `name` muncul sebagai frasa utuh di dalam `hay`? */
function containsPhrase(hay: string, name: string): boolean {
  return new RegExp(`(^|\\s)${name.replace(/\s+/g, "\\s+")}(\\s|$)`).test(hay);
}

/** Variasi urutan kata untuk nama 2-3 kata (mis. "Timur Cengkareng"). */
function wordOrders(name: string): string[] {
  const words = name.split(" ").filter(Boolean);
  if (words.length <= 1) return [name];
  const rev = [...words].reverse().join(" ");
  return [...new Set([name, rev])];
}

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Import setelah env ter-load (kiriminaja.ts baca env saat modul dimuat).
  const { anekaClient } = await import("../src/lib/anekadropship.ts");
  const { getProvinces, getCities, getDistricts } = await import("../src/lib/kiriminaja.ts");

  // ─── 1) Baca daftar produk ─────────────────────────────────────────────────
  const productsFile = path.resolve("tiktok-export/products.json");
  const raw = JSON.parse(fs.readFileSync(productsFile, "utf8"));
  const products: ProductRow[] = Array.isArray(raw) ? raw : raw.products ?? raw.data ?? [];
  console.log(`Produk dari products.json: ${products.length}`);

  // ─── 2) Scrape alamat seller tiap produk (cache ke file) ───────────────────
  const addrFile = path.resolve("tiktok-export/seller-addresses.json");
  let addresses: Record<string, { location: string; address: string }> = {};
  if (fs.existsSync(addrFile)) {
    addresses = JSON.parse(fs.readFileSync(addrFile, "utf8"));
    console.log(`Pakai cache alamat: ${Object.keys(addresses).length} produk`);
  } else {
    await anekaClient.ensureLoggedIn();
    let done = 0;
    const failed: string[] = [];
    for (const p of products) {
      try {
        const d = await anekaClient.getProductDetail(p.id);
        if (d?.name) {
          addresses[p.id] = {
            location: String(p.location ?? ""),
            address: d.alamatSeller ?? "",
          };
        } else {
          failed.push(p.id);
        }
      } catch {
        failed.push(p.id);
      }
      done++;
      if (done % 25 === 0) console.log(`  Scrape detail ${done}/${products.length}...`);
    }
    console.log(
      `Scrape selesai: ${Object.keys(addresses).length} ok, gagal: ${failed.length}`,
      failed.length ? failed.join(", ") : ""
    );
    fs.writeFileSync(addrFile, JSON.stringify(addresses, null, 2));
  }

  // ─── 3) Ambil daftar kota + kecamatan KiriminAja ───────────────────────────
  console.log("Ambil daftar provinsi/kota/kecamatan KiriminAja...");
  const provinces = await getProvinces();
  const citiesAll: CityEntry[] = [];
  for (const prov of provinces) {
    const cs = await getCities(prov.id);
    for (const c of cs) {
      const name = String(c.kabupaten_name ?? "").trim();
      if (name) citiesAll.push({ id: c.id, name, provinceId: prov.id });
    }
    await sleep(150);
  }
  console.log(`  Kota: ${citiesAll.length}`);

  /** Cari kota berdasarkan nama yang muncul di teks alamat/lokasi. */
  function matchCity(text: string): CityEntry | null {
    const t = norm(text);
    if (!t) return null;
    // 1) Nama kota utuh muncul di teks.
    for (const c of citiesAll) {
      if (containsPhrase(t, norm(c.name))) return c;
    }
    // 2) Coba tanpa prefiks kota/kab.
    for (const c of citiesAll) {
      const s = norm(stripPrefix(c.name));
      if (s && containsPhrase(t, s)) return c;
    }
    // 3) Teks juga dibersihkan dari kata kota/kabupaten.
    const tStripped = norm(
      t
        .split(" ")
        .filter((w) => w !== "kota" && w !== "kab" && w !== "kabupaten")
        .join(" ")
    );
    for (const c of citiesAll) {
      const s = norm(stripPrefix(c.name));
      if (s && containsPhrase(tStripped, s)) return c;
    }
    return null;
  }

  const districtCache = new Map<string, DistrictEntry[]>();
  async function districtsOf(city: CityEntry): Promise<DistrictEntry[]> {
    const key = String(city.id);
    const hit = districtCache.get(key);
    if (hit) return hit;
    const ds = await getDistricts(city.id);
    await sleep(150);
    const list: DistrictEntry[] = ds
      .map((d) => ({ id: d.id, name: String(d.kecamatan_name ?? "").trim() }))
      .filter((d) => d.name);
    districtCache.set(key, list);
    return list;
  }

  /** Cari kecamatan dari teks alamat, di dalam kota tertentu. */
  async function matchDistrict(text: string, city: CityEntry): Promise<DistrictEntry | null> {
    const t = norm(text);
    if (!t) return null;
    const ds = await districtsOf(city);
    const matches: DistrictEntry[] = [];
    for (const d of ds) {
      const names = wordOrders(norm(stripPrefix(d.name)));
      if (names.some((n) => containsPhrase(t, n))) matches.push(d);
    }
    return matches.length === 1 ? matches[0] : null;
  }

  // ─── 4) Resolusi per produk ────────────────────────────────────────────────
  console.log("Resolusi alamat -> kecamatan...");
  const byProductId: Record<string, number> = {};
  const byAddress: Record<string, number> = {};
  const unresolved: { id: string; location: string; address: string }[] = [];
  const cityDistrictSet: Record<string, Set<number>> = {}; // lokasi -> himpunan district

  let matched = 0;
  let idx = 0;
  const entries = Object.entries(addresses);
  for (const [id, info] of entries) {
    idx++;
    const address = String(info.address ?? "").trim();
    const location = String(info.location ?? "").trim();
    let districtId: number | null = null;

    if (address) {
      const city = matchCity(address);
      if (city) {
        const d = await matchDistrict(address, city);
        if (d) districtId = Number(d.id);
      }
    }

    if (!districtId && location) {
      // Fallback: nama kota dari badge lokasi (mis. "Sooko Mojokerto").
      const city = matchCity(location);
      if (city) {
        const key = norm(location);
        const ds = await districtsOf(city);
        const matchedDs = ds.filter((d) =>
          wordOrders(norm(stripPrefix(d.name))).some((n) => containsPhrase(key, n))
        );
        if (matchedDs.length === 1) {
          districtId = Number(matchedDs[0].id);
        } else {
          const set = (cityDistrictSet[key] ??= new Set<number>());
          for (const d of ds) set.add(Number(d.id));
        }
      }
    }

    if (districtId && Number.isFinite(districtId)) {
      byProductId[id] = districtId;
      if (address) {
        const aKey = norm(address);
        if (!(aKey in byAddress)) byAddress[aKey] = districtId;
      }
      matched++;
    } else {
      unresolved.push({ id, location, address });
    }
    if (idx % 50 === 0) console.log(`  ${idx}/${entries.length}...`);
  }

  // byLocation: hanya lokasi yang konsisten ke satu kecamatan di semua produknya.
  const byLocation: Record<string, number> = {};
  for (const [key, ids] of Object.entries(cityDistrictSet)) {
    if (ids.size === 1) byLocation[key] = Array.from(ids)[0];
  }

  // ─── 5) Tulis hasil ─────────────────────────────────────────────────────────
  const outPath = path.resolve("src/lib/seller-origins.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        byProductId: sortObj(byProductId),
        byAddress: sortObj(byAddress),
        byLocation: sortObj(byLocation),
      },
      null,
      2
    ) + "\n"
  );

  console.log("\n=== HASIL ===");
  console.log(`Produk: ${entries.length}`);
  console.log(`Ter-resolve: ${matched}`);
  console.log(`Belum resolve: ${unresolved.length}`);
  console.log(`byAddress (alamat unik): ${Object.keys(byAddress).length}`);
  console.log(`byLocation (kota konsisten): ${Object.keys(byLocation).length}`);

  const cityCounts: Record<string, number> = {};
  for (const u of unresolved) {
    const k = u.location || "(tanpa lokasi)";
    cityCounts[k] = (cityCounts[k] ?? 0) + 1;
  }
  if (unresolved.length) {
    console.log("\nBelum resolve per lokasi:");
    for (const [k, n] of Object.entries(cityCounts)) console.log(`  ${k}: ${n}`);
    console.log("\nContoh (maks 10):");
    for (const u of unresolved.slice(0, 10)) {
      console.log(`  [${u.id}] ${u.location} | ${u.address.slice(0, 90)}`);
    }
  }
}

main().catch((e) => {
  console.error("Gagal:", e);
  process.exit(1);
});
