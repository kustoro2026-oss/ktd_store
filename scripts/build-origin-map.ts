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

/** Singkatan umum di alamat → bentuk penuh (hanya untuk teks yang dicari). */
const ABBREV: Record<string, string> = {
  pd: "pondok",
  bks: "bekasi",
  jkt: "jakarta",
  tgr: "tangerang",
  bdg: "bandung",
  sby: "surabaya",
  yk: "yogyakarta",
};

/** Normalisasi + ekspansi singkatan alamat (mis. "Pd. Gede" → "pondok gede"). */
function normx(s: string): string {
  return norm(s)
    .split(" ")
    .map((w) => ABBREV[w] ?? w)
    .join(" ")
    .trim();
}

/** Buang kata umum wilayah (kota/kab/kec/kel) dari teks. */
function stripAreaWords(s: string): string {
  const drop = new Set(["kota", "kab", "kabupaten", "kec", "kecamatan", "kel", "kelurahan"]);
  return s
    .split(" ")
    .filter((w) => !drop.has(w))
    .join(" ");
}

/** Hapus kemunculan frasa (kata utuh) dari teks yang sudah dinormalisasi. */
function removePhrase(text: string, phrase: string): string {
  if (!phrase) return text;
  const parts = text.split(" ");
  const ph = phrase.split(" ");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (ph.every((w, j) => parts[i + j] === w)) {
      i += ph.length - 1;
      continue;
    }
    out.push(parts[i]);
  }
  return out.join(" ");
}

/** true jika `a` adalah barisan kata berurutan di dalam `b`. */
function isSubSeq(a: string[], b: string[]): boolean {
  for (let i = 0; i + a.length <= b.length; i++) {
    if (a.every((w, j) => b[i + j] === w)) return true;
  }
  return false;
}

/**
 * Buang kandidat yang namanya bagian dari nama kandidat lain — "Tangerang"
 * kalah dari "Tangerang Selatan" saat keduanya sama-sama muncul.
 */
function dropSubphrases(list: CityEntry[]): CityEntry[] {
  const keys = list.map((c) => normx(c.name));
  return list.filter(
    (_, i) =>
      !keys.some((k, j) => j !== i && k !== keys[i] && isSubSeq(keys[i].split(" "), k.split(" ")))
  );
}

/** Buang penyebutan nama kota (dengan/tanpa prefiks) dari teks normal. */
function removeCityNames(t: string, cityName: string): string {
  let out = removePhrase(t, normx(cityName));
  const bare = normx(stripPrefix(cityName));
  if (bare && bare !== normx(cityName)) out = removePhrase(out, bare);
  return out;
}

/**
 * Override terkurasi: jalan/kelurahan yang kecamatannya sudah diverifikasi
 * manual (web) tetapi tidak tertulis di teks alamat.
 */
const CURATED: { test: RegExp; city: string; district: string }[] = [
  // Jl. Tebo Selatan → Kel. Mulyorejo, Kec. Sukun, Kota Malang.
  { test: /tebo selatan/i, city: "Malang", district: "Sukun" },
  // Jl. Tirtoyoso / Nanggulan → Kel. Kutowinangun Kidul, Kec. Tingkir, Salatiga.
  { test: /tirtoyoso|nanggulan/i, city: "Salatiga", district: "Tingkir" },
  // Jl. F Karang Anyar → Kel. Karang Anyar, Kec. Sawah Besar, Jakarta Pusat.
  { test: /karang anyar/i, city: "Jakarta Pusat", district: "Sawah Besar" },
  // Rempoa → Kec. Ciputat Timur, Kota Tangerang Selatan.
  { test: /rempoa/i, city: "Tangerang Selatan", district: "Ciputat Timur" },
  // Jl. Raya Sukahati ("Suka Hati") → Kel. Sukahati, Kec. Cibinong, Kab. Bogor.
  { test: /suka ?hati/i, city: "Bogor", district: "Cibinong" },
  // Cluster JakUt (alamat hanya "KOTA JAKARTA UTARA") → default Kec. Kelapa
  // Gading (area gudang e-commerce). Pilihan user, bisa diganti nanti.
  { test: /jakarta utara/i, city: "Jakarta Utara", district: "Kelapa Gading" },
];

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

  /**
   * Semua kota yang namanya muncul di teks, diurutkan dari nama terpanjang
   * (paling spesifik) — mis. "Kota Tangerang Selatan" menang atas
   * "Kota Tangerang". Pemanggil mencoba tiap kandidat agar tidak salah kota.
   */
  function matchCities(text: string): CityEntry[] {
    const t = normx(text);
    if (!t) return [];
    const byLen = (a: CityEntry, b: CityEntry) => b.name.length - a.name.length;

    // 1) Nama kota utuh muncul di teks.
    const full = citiesAll.filter((c) => containsPhrase(t, normx(c.name)));
    if (full.length) return dropSubphrases(full).sort(byLen);

    // 2) Coba tanpa prefiks kota/kab.
    const stripped = citiesAll.filter((c) => {
      const s = normx(stripPrefix(c.name));
      return s && containsPhrase(t, s);
    });
    if (stripped.length) return dropSubphrases(stripped).sort(byLen);

    // 3) Teks juga dibersihkan dari kata kota/kabupaten.
    const tStripped = stripAreaWords(t);
    const loose = citiesAll.filter((c) => {
      const s = normx(stripPrefix(c.name));
      return s && containsPhrase(tStripped, s);
    });
    return dropSubphrases(loose).sort(byLen);
  }

  const districtCache = new Map<string, DistrictEntry[]>();

  /** Retry wrapper: coba ulang hingga 3x dengan jeda bertambah. */
  async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt < 2) {
          const wait = 2000 * (attempt + 1);
          console.log(`  ⚠ Retry ${attempt + 1}/2 ${label} (tunggu ${wait / 1000}s)...`);
          await sleep(wait);
        } else {
          throw e;
        }
      }
    }
    throw new Error("unreachable");
  }

  async function districtsOf(city: CityEntry): Promise<DistrictEntry[] | null> {
    const key = String(city.id);
    const hit = districtCache.get(key);
    if (hit) return hit;
    try {
      const ds = await withRetry(() => getDistricts(city.id), `districtsOf(${city.name})`);
      await sleep(500);
      const list: DistrictEntry[] = ds
        .map((d) => ({ id: d.id, name: String(d.kecamatan_name ?? "").trim() }))
        .filter((d) => d.name);
      districtCache.set(key, list);
      return list;
    } catch {
      console.log(`  ✗ Gagal ambil kecamatan ${city.name} (skip)`);
      return null;
    }
  }

  /**
   * Cari kecamatan dari teks alamat, di dalam kota tertentu.
   * Pass 1: teks tanpa penyebutan nama kota — agar "Kota Tangerang" tidak
   * terbaca sebagai Kecamatan Tangerang / "Kota Bandung" sebagai Kec. Bandung.
   * Pass 2 (cadangan): teks asli — mis. "Kec. Bandung Kidul" yang ikut
   * mengandung kata kota.
   */
  async function matchDistrict(text: string, city: CityEntry): Promise<DistrictEntry | null> {
    const t0 = normx(text);
    if (!t0) return null;
    const ds = await districtsOf(city);
    if (!ds) return null;
    const pick = (t: string): DistrictEntry | null => {
      const matches: DistrictEntry[] = [];
      for (const d of ds) {
        const names = wordOrders(norm(stripPrefix(d.name)));
        if (names.some((n) => containsPhrase(t, n))) matches.push(d);
      }
      if (matches.length <= 1) return matches[0] ?? null;
      // Banyak kandidat (mis. kecamatan + kelurahan bernama sama): utamakan
      // yang disebut setelah kata "kec"/"kecamatan".
      const withKec = matches.filter((d) => {
        const names = wordOrders(norm(stripPrefix(d.name)));
        return names.some((n) =>
          new RegExp(`(^|\\s)kec(amatan)?\\s+${n.replace(/\s+/g, "\\s+")}(\\s|$)`).test(t)
        );
      });
      return withKec.length === 1 ? withKec[0] : null;
    };
    return pick(removeCityNames(t0, city.name)) ?? pick(t0);
  }

  /** Cari pasangan kota+kecamatan untuk entri override terkurasi. */
  async function findCurated(
    cityName: string,
    districtName: string
  ): Promise<{ city: CityEntry; district: DistrictEntry } | null> {
    const target = normx(districtName);
    const key = normx(cityName);
    const pools = [
      citiesAll.filter((c) => normx(c.name) === key),
      citiesAll.filter((c) => normx(c.name).includes(key)),
    ];
    for (const pool of pools) {
      const found = new Map<number, { city: CityEntry; district: DistrictEntry }>();
      for (const c of pool) {
        const ds = await districtsOf(c);
        const d = ds?.find((x) => normx(stripPrefix(x.name)) === target);
        if (d) found.set(Number(d.id), { city: c, district: d });
      }
      const vals = [...found.values()];
      if (vals.length === 1) return vals[0];
      if (vals.length > 1) return null; // ambigu antar kota, batal.
    }
    return null;
  }

  // ─── 4) Resolusi per produk ────────────────────────────────────────────────
  console.log("Resolusi alamat -> kecamatan...");
  const byProductId: Record<string, number> = {};
  const byAddress: Record<string, number> = {};
  const unresolved: { id: string; location: string; address: string }[] = [];
  /** Lokasi badge → himpunan kecamatan hasil resolve (untuk byLocation). */
  const locationDistrictSet: Record<string, Set<number>> = {};
  /** Entri yang baru ter-resolve di jalankan ini (laporan verifikasi). */
  const newlyResolved: {
    id: string;
    address: string;
    location: string;
    districtId: number;
    districtName: string;
    cityName: string;
    via: string;
  }[] = [];

  const outPath = path.resolve("src/lib/seller-origins.json");

  /** Simpan hasil sementara (incremental) agar tidak hilang saat gagal. */
  function saveProgress() {
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          byProductId: sortObj(byProductId),
          byAddress: sortObj(byAddress),
          byLocation: sortObj(byLocationCurrent()),
        },
        null,
        2
      ) + "\n"
    );
  }

  function byLocationCurrent(): Record<string, number> {
    const m: Record<string, number> = {};
    for (const [key, ids] of Object.entries(locationDistrictSet)) {
      if (ids.size === 1) m[key] = Array.from(ids)[0];
    }
    return m;
  }

  // Resume dari hasil sebelumnya (jika ada).
  const prevPath = path.resolve("src/lib/seller-origins.json");
  if (fs.existsSync(prevPath)) {
    const prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
    Object.assign(byProductId, prev.byProductId ?? {});
    Object.assign(byAddress, prev.byAddress ?? {});
    const prevCount = Object.keys(byProductId).length;
    if (prevCount > 0) console.log(`Resume dari ${prevCount} produk yang sudah ter-resolve.`);
  }

  let matched = Object.keys(byProductId).length;
  let idx = 0;
  const entries = Object.entries(addresses);

  // Backfill lokasi dari entri yang sudah ada agar byLocation lengkap.
  for (const [id, info] of entries) {
    const d = byProductId[id];
    const loc = String(info.location ?? "").trim();
    if (d && loc) (locationDistrictSet[norm(loc)] ??= new Set<number>()).add(d);
  }
  for (const [id, info] of entries) {
    idx++;
    // Skip produk yang sudah ter-resolve sebelumnya.
    if (byProductId[id]) continue;

    const address = String(info.address ?? "").trim();
    const location = String(info.location ?? "").trim();

    // Kandidat kota dari alamat + badge lokasi (dedupe, paling spesifik dulu).
    const candidates: CityEntry[] = [];
    const seenCity = new Set<string>();
    for (const c of [...matchCities(address), ...matchCities(location)]) {
      const k = String(c.id);
      if (seenCity.has(k)) continue;
      seenCity.add(k);
      candidates.push(c);
    }

    /**
     * Coba alamat dulu, lalu badge lokasi. Hasil diterima HANYA jika tepat satu
     * kecamatan unik dari seluruh kandidat kota (hindari salah map origin).
     */
    let districtId: number | null = null;
    let districtName = "";
    let cityName = "";
    let via = "auto";

    // Override terkurasi lebih dulu (jalan/kelurahan yang sudah diverifikasi).
    const curated = CURATED.find((c) => c.test.test(address) || c.test.test(location));
    if (curated) {
      const hit = await findCurated(curated.city, curated.district);
      if (hit) {
        districtId = Number(hit.district.id);
        districtName = hit.district.name;
        cityName = hit.city.name;
        via = "curated";
      }
    }

    for (const src of [address, location]) {
      if (!src || districtId) continue;
      const hits = new Map<number, { name: string; city: string }>();
      for (const city of candidates) {
        const d = await matchDistrict(src, city);
        if (d) hits.set(Number(d.id), { name: d.name, city: city.name });
      }
      if (hits.size === 1) {
        const [onlyId, only] = [...hits.entries()][0];
        districtId = onlyId;
        districtName = only.name;
        cityName = only.city;
      }
    }

    if (districtId && Number.isFinite(districtId)) {
      newlyResolved.push({ id, address, location, districtId, districtName, cityName, via });
      byProductId[id] = districtId;
      if (address) {
        const aKey = norm(address);
        if (!(aKey in byAddress)) byAddress[aKey] = districtId;
      }
      if (location) {
        (locationDistrictSet[norm(location)] ??= new Set<number>()).add(districtId);
      }
      matched++;
    } else {
      unresolved.push({ id, location, address });
    }
    if (idx % 50 === 0) {
      console.log(`  ${idx}/${entries.length}... (save checkpoint)`);
      saveProgress();
    }
  }

  // byLocation: lokasi badge yang di semua produknya resolve ke satu kecamatan.
  const byLocation: Record<string, number> = {};
  for (const [key, ids] of Object.entries(locationDistrictSet)) {
    if (ids.size === 1) byLocation[key] = Array.from(ids)[0];
  }

  // ─── 5) Tulis hasil final ───────────────────────────────────────────────────
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

  // Laporan verifikasi: entri yang BARU ter-resolve di jalankan ini.
  if (newlyResolved.length) {
    fs.writeFileSync(
      path.resolve("tiktok-export/origin-map-new.json"),
      JSON.stringify(newlyResolved, null, 2) + "\n"
    );
  }

  // Daftar produk yang belum bisa dipetakan (untuk review manual).
  fs.writeFileSync(
    path.resolve("tiktok-export/origin-map-unresolved.json"),
    JSON.stringify(unresolved, null, 2) + "\n"
  );

  console.log("\n=== HASIL ===");
  console.log(`Produk: ${entries.length}`);
  console.log(`Ter-resolve: ${matched}`);
  console.log(`  Baru di jalankan ini: ${newlyResolved.length} (tiktok-export/origin-map-new.json)`);
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
