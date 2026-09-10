/**
 * Util: ubah data varian anekadropship -> baris TikTok bulk template.
 *
 * Anekadropship menyimpan varian sebagai satu label gabungan di field `name`
 * (mis. "BLACK - S"), dengan `color`/`size` sering null. Util ini memecah
 * label menjadi sumbu "Warna" + "Ukuran" (nama varian TikTok), lalu memberi
 * harga/stok/SKU per varian.
 *
 * Dipakai oleh script fill kategori (tiktok-pakaian-fix.ts dll).
 */

export type VarianRow = {
  /** Nama varian utama (mis. "Warna"). "" jika tidak ada. */
  axis1Name: string;
  /** Nilai varian utama (mis. "BLACK"). */
  axis1Value: string;
  /** Nama varian sekunder (mis. "Ukuran"). "" jika tidak ada. */
  axis2Name: string;
  /** Nilai varian sekunder (mis. "S"). */
  axis2Value: string;
  /** Label asli varian dari supplier. */
  label: string;
  /** Harga jual varian (number|null). */
  price: number | null;
  /** Stok varian (number|null). */
  stock: number | null;
  /** ID varian supplier (untuk SKU unik). */
  variantId: string;
};

/** Pola yang menunjukkan nilai ukuran. */
const SIZE_RE =
  /^(?:XS|XXS|XXXS|S|M|L|XL|XXL|XXXL|XXXXL|2XL|3XL|4XL|5XL|6XL|7XL|ALL\s*SIZE|ONE\s*SIZE|FREESIZE|SEMUA\s*UKURAN|JUMBO|KING\s*SIZE|QUEEN\s*SIZE|\d{1,4}(?:[.,]\d+)?\s*(?:CM|MM|INCH|INC|M|GR|G|ML|L)?|US\s*\d+(?:[.,]\d+)?|EU\s*\d+(?:[.,]\d+)?|\d{2,3}(?:-\d{2,3})?)$/i;

/** Kata-kata yang jelas merupakan warna (bukan ukuran). */
const COLOR_WORDS =
  /black|white|merah|hitam|putih|biru|kuning|hijau|pink|mocca|cream|krem|army|navy|maroon|abu|grey|gray|coklat|gold|golden|silver|orange|ungu|tosca|salem|peach|denim|khaki|mint|grape|latte|beige|olive|brown|red|blue|green|yellow|purple|bordeaux|mustard|cappuccino|dusty|sakura|lilac|sky|emerald|ruby|sapphire/i;

function looksLikeSize(s: string): boolean {
  return SIZE_RE.test(s.trim());
}

/** Apakah teks mengandung kata warna yang dikenal. */
export function looksLikeColorWord(s: string): boolean {
  return COLOR_WORDS.test(s.trim());
}

/** Parse "69000.00" / "Rp 89.100" / "89.100,00" -> number | null */
export function parsePrice(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const m = String(s).trim().match(/[\d][\d.,]*/);
  if (!m) return null;
  const raw = m[0];
  let n: number;
  if (raw.includes(",")) {
    // Format Indonesia: titik = ribuan, koma = desimal ("89.100,00").
    n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // Titik ribuan tanpa desimal ("1.000").
    n = parseFloat(raw.replace(/\./g, ""));
  } else {
    // Desimal biasa ("69000.00").
    n = parseFloat(raw);
  }
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Pecah label varian menjadi pasangan (warna, ukuran) jika memungkinkan.
 * Return { warna, ukuran, label } — salah satu bisa null.
 */
export function splitLabel(label: string): { warna: string | null; ukuran: string | null } {
  const name = String(label ?? "").trim();
  if (!name) return { warna: null, ukuran: null };

  const parts = name.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1).join(" - ");
    if (looksLikeSize(last)) {
      // "BLACK - S" / "MERAH - 3XL" -> warna + ukuran
      return { warna: rest, ukuran: last };
    }
    if (looksLikeColorWord(parts[0]) && looksLikeSize(parts[1])) {
      return { warna: parts[0], ukuran: parts.slice(1).join(" - ") };
    }
    // Dua kata non-ukuran (mis. "MERAH - HITAM"): tetap satu axis warna.
    return { warna: name, ukuran: null };
  }
  if (looksLikeSize(name)) return { warna: null, ukuran: name };
  return { warna: name, ukuran: null };
}

/**
 * Ubah daftar varian mentah anekadropship menjadi baris TikTok.
 * - Varian non-aktif (isActive=false) atau stok 0 dilewati.
 * - Sumbu ditentukan dari data: jika supplier mengisi color/size terpisah,
 *   dipakai langsung; kalau tidak, label dipecah dengan splitLabel().
 */
export function toVariantRows(
  variants: Array<{
    id?: string | number;
    name?: string;
    color?: string | null;
    size?: string | null;
    price?: string | number;
    stock?: number;
    isActive?: boolean;
  }>
): VarianRow[] {
  const rows: VarianRow[] = [];
  for (const v of variants ?? []) {
    const isActive = v.isActive !== false;
    const stock = typeof v.stock === "number" && Number.isFinite(v.stock) ? v.stock : null;
    if (!isActive || (stock !== null && stock <= 0)) continue;

    let warna = v.color?.trim() || null;
    let ukuran = v.size?.trim() || null;
    const label = String(v.name ?? "").trim();
    if (!warna && !ukuran) {
      const s = splitLabel(label);
      warna = s.warna;
      ukuran = s.ukuran;
    }
    // Kata tunggal yang bukan warna (mis. "Patin", "Bubble Wrap Tipis")
    // bukan axis Warna -> jadikan axis Varian generik.
    let varianLain: string | null = null;
    if (warna && !ukuran && !looksLikeColorWord(warna)) {
      varianLain = warna;
      warna = null;
    }
    rows.push({
      axis1Name: warna ? "Warna" : ukuran ? "Ukuran" : "Varian",
      axis1Value: warna ?? ukuran ?? varianLain ?? label,
      axis2Name: warna && ukuran ? "Ukuran" : "",
      axis2Value: warna && ukuran ? ukuran : "",
      label: label || [warna, ukuran, varianLain].filter(Boolean).join(" - "),
      price: parsePrice(v.price),
      stock,
      variantId: String(v.id ?? ""),
    });
  }
  return rows;
}

/** Nama axis TikTok max 20 char, nilai max 50 char. */
export function sanitizeAxis(s: string, max = 50): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
