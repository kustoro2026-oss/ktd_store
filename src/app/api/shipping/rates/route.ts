import { getRates, upstreamError, type KARate } from "@/lib/kiriminaja";
import { getDetailCached } from "@/lib/detail-cache";
import {
  fallbackOriginDistrict,
  normalizeOriginKey,
  resolveOriginDistrict,
} from "@/lib/origin-resolver";

type RateGroup = {
  /** ID kecamatan pengirim (origin). */
  origin: number;
  /** Kunci grup: kecamatan + identitas seller (alamat/kota). */
  sellerKey: string;
  /** Label lokasi seller untuk ditampilkan (mis. alamat gudang). */
  label: string;
  /** Total berat paket grup ini (gram). */
  weight: number;
  /** Berat estimasi untuk item yang datanya tidak tersedia. */
  estimated?: boolean;
  /** ID produk yang masuk paket ini (peta produk -> paket). */
  itemIds: string[];
  results: KARate[];
};

const DEFAULT_ITEM_WEIGHT = 1000; // gram — dipakai jika data berat item tidak ada

/** Ambil nilai rupiah dari teks harga katalog, mis. "Rp 99.000" -> 99000. */
function parsePriceText(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** Singkatan alamat umum — disetarakan agar "Jl" dan "Jalan" dianggap sama. */
const ADDR_ABBREV: Record<string, string> = { jl: "jalan", gg: "gang" };

/** True jika dua kata hanya berbeda maksimal 1 edit (typo hasil scrape). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (a.length > b.length) {
      i += 1;
      if (++edits > 1) return false;
    } else if (b.length > a.length) {
      j += 1;
      if (++edits > 1) return false;
    } else {
      i += 1;
      j += 1;
      if (++edits > 1) return false;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Token cocok: identik, atau typo 1 huruf pada kata panjang tanpa angka. */
function addressTokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  return withinOneEdit(a, b);
}

/** "24B" -> "24 b": nomor selalu token tersendiri agar bisa dibandingkan. */
function splitAlphaDigit(t: string): string[] {
  return t
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
}

/**
 * Kunci identitas seller dari teks alamat: ambil segmen jalan (sebelum koma
 * pertama), normalkan, lalu samakan singkatan. Kota/provinsi/kode pos ikut
 * terbuang bersama segmen lanjutan — paket ditentukan jalan gudang seller,
 * bukan wilayah administratifnya.
 */
function sellerAddressKey(raw: string): string {
  const first = raw.split(",")[0]?.trim() || raw;
  const norm = normalizeOriginKey(first) || normalizeOriginKey(raw);
  return norm
    .split(" ")
    .flatMap(splitAlphaDigit)
    .map((t) => ADDR_ABBREV[t] ?? t)
    .join(" ");
}

/** Semua token `needles` ada di `haystack` (multiset, token typo-toleran). */
function isTokenSubset(needles: string[], haystack: string[]): boolean {
  const pool = [...haystack];
  outer: for (const n of needles) {
    for (let i = 0; i < pool.length; i++) {
      if (addressTokenMatch(n, pool[i])) {
        pool.splice(i, 1);
        continue outer;
      }
    }
    return false;
  }
  return true;
}

/**
 * Dua kunci seller merujuk gudang yang sama meski teks alamatnya berbeda?
 * Menangani varian hasil scrape: potongan/awalan alamat ("Gudang X Ngrancang"
 * vs "Ngrancang"), typo 1 huruf ("Darusalam" vs "Darussalam"), dan singkatan
 * (jl/jalan). Pengaman: token berangka (nomor rumah/RT) dan huruf tunggal
 * (blok) harus cocok, sehingga "no 24" tidak dianggap sama dengan "no 30".
 * Kunci <3 token tidak pernah difusikan agar kata kota generik ("Jombang")
 * tidak menelan alamat jalan yang kebetulan menyebut kota itu.
 */
function isSameSellerAddress(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b || a === "unknown" || b === "unknown") return false;
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  const digitsA = ta.filter((t) => /\d/.test(t));
  const digitsB = tb.filter((t) => /\d/.test(t));
  if (!isTokenSubset(digitsA, digitsB) && !isTokenSubset(digitsB, digitsA)) {
    return false;
  }
  const singlesA = ta.filter((t) => t.length === 1);
  const singlesB = tb.filter((t) => t.length === 1);
  if (!isTokenSubset(singlesA, singlesB) || !isTokenSubset(singlesB, singlesA)) {
    return false;
  }
  if (ta.length < 3 || tb.length < 3) return false;
  const overlap = (x: string[], y: string[]) => {
    const pool = [...y];
    let hit = 0;
    outer: for (const t of x) {
      for (let i = 0; i < pool.length; i++) {
        if (addressTokenMatch(t, pool[i])) {
          pool.splice(i, 1);
          hit += 1;
          continue outer;
        }
      }
    }
    return hit / x.length;
  };
  return overlap(ta, tb) >= 0.75 || overlap(tb, ta) >= 0.75;
}

export async function POST(request: Request) {
  let body: {
    destination?: unknown;
    weight?: unknown;
    qty?: unknown;
    itemValue?: unknown;
    courier?: unknown;
    productId?: unknown;
    productIds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const destination = Number(body.destination);
  if (!destination || !Number.isFinite(destination)) {
    return Response.json({ error: "Kecamatan tujuan wajib dipilih" }, { status: 400 });
  }

  const itemValue = Number(body.itemValue);
  const courier = Array.isArray(body.courier)
    ? (body.courier as string[]).map(String)
    : undefined;

  const ids = Array.isArray(body.productIds)
    ? (body.productIds as unknown[]).map(String).filter(Boolean)
    : typeof body.productId === "string" && body.productId
      ? [body.productId]
      : [];

  const fallbackWeight = Number(body.weight);
  const qtyRaw = Number(body.qty);
  const qty =
    Number.isFinite(qtyRaw) && qtyRaw > 1
      ? Math.min(Math.round(qtyRaw), 999)
      : 1;

  try {
    if (ids.length > 0) {
      const groups = await rateGroupsForProducts({
        ids,
        destination,
        itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
        courier,
        fallbackWeight,
        qty,
      });
      return Response.json({ groups, destination });
    }

    // Jalur lama tanpa produk: pakai origin global toko + berat dari klien.
    const weight = Math.round(fallbackWeight);
    if (!weight || !Number.isFinite(weight) || weight < 1) {
      return Response.json({ error: "Berat paket wajib diisi (gram)" }, { status: 400 });
    }
    const origin = fallbackOriginDistrict();
    if (!origin) {
      return upstreamError("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");
    }
    const result = await getRates({
      origin,
      destination,
      weight,
      itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
      courier,
    });
    return Response.json({
      groups: [
        {
          origin,
          sellerKey: "ktd-store",
          label: "Dikirim dari gudang KTD Store",
          weight,
          itemIds: [],
          results: result.results,
        },
      ],
      destination,
    });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal menghitung ongkir");
  }
}

/**
 * Hitung ongkir per kelompok seller: setiap produk dipetakan ke kecamatan
 * asal seller-nya, lalu barang dengan origin + seller sama digabung jadi satu
 * paket. Dua seller berbeda di kecamatan yang sama tetap menjadi paket
 * terpisah (ongkir dihitung per paket kiriman). Identitas seller diambil dari
 * segmen jalan alamat gudang; varian teks dari scrape difusikan lewat
 * isSameSellerAddress supaya produk satu seller tidak terpecah jadi beberapa
 * paket.
 *
 * Berat per produk diambil dari data produk (beratGram); bila tidak ada,
 * pakai berat dari klien (`fallbackWeight`, berat PER ITEM) lalu kalikan qty.
 *
 * itemValue (asuransi): single-paket memakai nilai dari klien (subtotal);
 * multi-paket dihitung per grup dari harga katalog masing-masing item.
 *
 * ⚡ Optimasi: fetch detail produk dan tarif secara paralel (Promise.all)
 * supaya latency tidak menumpuk (sebelumnya sequential for‑of).
 */
async function rateGroupsForProducts(opts: {
  ids: string[];
  destination: number;
  itemValue?: number;
  courier?: string[];
  fallbackWeight: number;
  qty: number;
}): Promise<RateGroup[]> {
  const { ids, destination, itemValue, courier, fallbackWeight, qty } = opts;
  const uniqueIds = [...new Set(ids)];

  // Berat dari klien dianggap berat PER ITEM (modal mengirim berat 1 unit).
  const perItemFallback =
    Number.isFinite(fallbackWeight) && fallbackWeight > 0
      ? fallbackWeight / uniqueIds.length
      : 0;

  // 1) Fetch semua detail produk secara paralel.
  const detailResults = await Promise.all(
    uniqueIds.map(async (id) => {
      const detail = await getDetailCached(id);
      return { id, detail };
    })
  );

  // 2) Kumpulkan origin + berat tiap produk, dikelompokkan per seller.
  const entries = new Map<
    string,
    {
      origin: number;
      sellerKey: string;
      label: string;
      weight: number;
      estimated: boolean;
      /** Total harga item paket (untuk asuransi item_value per paket). */
      value: number;
      itemIds: string[];
    }
  >();

  for (const { id, detail } of detailResults) {
    if (!detail?.name) continue;

    const origin = resolveOriginDistrict({
      productId: id,
      alamatSeller: detail.alamatSeller,
      location: detail.location,
    });
    const districtId = origin?.districtId ?? fallbackOriginDistrict();
    if (!districtId) {
      throw new Error("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");
    }

    const knownWeight = detail.beratGram;
    const baseWeight =
      knownWeight && knownWeight > 0
        ? knownWeight
        : perItemFallback > 0
          ? perItemFallback
          : DEFAULT_ITEM_WEIGHT;
    const weight = baseWeight * qty;

    // Identitas seller: jalan gudang (utama) -> kota lokasi -> tidak diketahui.
    // Agar dua seller beda di kecamatan sama tidak tercampur jadi satu paket,
    // tapi varian teks alamat seller yang sama tetap menyatu (lihat
    // isSameSellerAddress di bawah).
    const sellerKey =
      (detail.alamatSeller && sellerAddressKey(detail.alamatSeller)) ||
      (detail.location && sellerAddressKey(detail.location)) ||
      "unknown";
    let groupKey = `${districtId}::${sellerKey}`;
    if (!entries.has(groupKey)) {
      // Fusikan ke grup seller yang sudah ada di kecamatan sama bila alamatnya
      // hanya beda penulisan (typo, potongan alamat, singkatan).
      for (const [k, v] of entries) {
        if (v.origin === districtId && isSameSellerAddress(v.sellerKey, sellerKey)) {
          groupKey = k;
          break;
        }
      }
    }

    const label = detail.alamatSeller
      ? detail.alamatSeller
      : origin
        ? `Dikirim dari gudang seller${detail.location ? ` (${detail.location})` : ""}`
        : "Dikirim dari gudang KTD Store";

    const itemPrice = parsePriceText(detail.rekomendasiJual);

    const prev = entries.get(groupKey);
    if (prev) {
      prev.weight += weight;
      prev.estimated = prev.estimated || !knownWeight;
      prev.value += itemPrice;
      prev.itemIds.push(id);
    } else {
      entries.set(groupKey, {
        origin: districtId,
        sellerKey,
        label,
        weight,
        estimated: !knownWeight,
        value: itemPrice,
        itemIds: [id],
      });
    }
  }

  if (entries.size === 0) {
    throw new Error("Produk tidak ditemukan. Coba muat ulang halaman produk.");
  }

  // 3) Hitung tarif per grup secara paralel.
  const multi = entries.size > 1;

  const groupResults = await Promise.all(
    [...entries.values()].map(async (g) => {
      const weight = Math.max(1, Math.round(g.weight));
      const result = await getRates({
        origin: g.origin,
        destination,
        weight,
        // Asuransi per paket: untuk multi-paket item_value dihitung dari
        // jumlah harga item grup ini (nilai keranjang utuh tidak bisa dibagi).
        itemValue: multi ? (g.value > 0 ? g.value : undefined) : itemValue,
        courier,
      });
      return {
        origin: g.origin,
        sellerKey: g.sellerKey,
        label: g.label,
        weight,
        estimated: g.estimated,
        itemIds: g.itemIds,
        results: result.results,
      } satisfies RateGroup;
    })
  );

  return groupResults;
}
