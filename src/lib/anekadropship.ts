import * as cheerio from "cheerio";

const BASE = "https://anekadropship.id";

/** Merge duplicated / near-duplicate anekadropship categories into one. */
const CATEGORY_ALIASES: Record<string, string> = {
  "kebutuhan rumah tangga": "Alat Rumah Tangga",
  "perawatan kesehatan hewan": "Perawatan Hewan",
  "sparparet mobil": "SparePart",
  "flatshoes": "Sepatu wanita",
  "sandal flat wanita": "Sepatu wanita",
};

/** Display-name overrides (canonical slug -> pretty title). */
const CATEGORY_DISPLAY: Record<string, string> = {
  SparePart: "Spare Part",
};

const SMALL_WORDS = new Set(["dan", "atau", "yang", "di", "ke", "&"]);

/**
 * Strip dropshipper store tags (e.g. [PG STORE], [META ADS ONLY], META ADS)
 * from a product title so only the real product name remains.
 */
function cleanProductName(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  // Leading bracketed store tags like [PG STORE] [META ADS ONLY]
  s = s.replace(/^\s*(?:\[[^\]]*\]\s*)+/, "");
  // Common ad-only tokens anywhere in the title
  s = s.replace(/\b(?:META\s*ADS(?:\s*ONLY)?|ADS\s*ONLY)\b/gi, " ");
  // Any remaining bracketed tokens
  s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
  // Unbalanced bracketed tags (typo'd closing brace, e.g. "[PG STORE}")
  s = s.replace(/\s*\[[^\]]*[}\]]\s*/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || raw.trim();
}

function titleCaseCategory(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) =>
      SMALL_WORDS.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * Parse teks berat dari halaman produk anekadropship menjadi gram.
 * Mendukung: "500.00 Gram" → 500, "1.000 Gram" → 1000, "1,5 Kg" → 1500,
 * "250 gr" → 250, "2 ons" → 200. Return null jika tidak bisa diparse.
 */
export function parseWeightToGram(s: string): number | null {
  if (!s) return null;
  const m = s.trim().replace(/\s+/g, " ").match(/^([\d.,]+)(?:\s*([a-z]+))?$/i);
  if (!m) return null;
  const raw = m[1];
  let num: number;
  if (raw.includes(",")) {
    // Format Indonesia: titik = pemisah ribuan, koma = desimal.
    num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // Titik pemisah ribuan ("1.000").
    num = parseFloat(raw.replace(/\./g, ""));
  } else {
    num = parseFloat(raw);
  }
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("kg")) return Math.round(num * 1000);
  if (unit.startsWith("ons")) return Math.round(num * 100);
  return Math.round(num); // gram (default)
}

/**
 * Tidy a scraped product description so only product-relevant content is shown:
 * - removes inlined base64 images (massive data URIs from the source page)
 * - cuts the internal "Panduan Aman Upload Produk ke Marketplace" seller guide
 * - removes "META ADS ONLY ..." internal ad notes
 * - removes "marketing kit" references ("GAMBAR MOTIF ... MARKETING KIT")
 * - drops empty paragraphs, decorative separator lines, and broken <img> tags
 * - returns "" when the scrape captured a whole page instead of a description
 */
function cleanDescription(html: string): string {
  if (!html) return "";

  let out = html;

  // 1) Strip inlined base64 data (huge images the source page embeds).
  out = out.replace(/<img[^>]*src=["']data:image\/[^"']*["'][^>]*>/gi, "");
  out = out.replace(/src=["']data:[^"']+["']/gi, "");
  // Drop <img> tags left without a real src.
  out = out.replace(/<img[^>]*>/gi, (tag) => (/src\s*=\s*["'][^"']+["']/i.test(tag) ? tag : ""));

  // 2) Internal seller guide appended to the end of many descriptions.
  const guideKey = "panduan aman upload produk";
  const guideIdx = out.toLowerCase().indexOf(guideKey);
  if (guideIdx >= 0) {
    const head = out.slice(0, guideIdx);
    let block = -1;
    for (const t of ["<p", "<li", "<ul", "<ol", "<div", "<h1", "<h2", "<h3", "<h4", "<table"]) {
      block = Math.max(block, head.lastIndexOf(t));
    }
    // Cut from the block containing the guide (avoids dangling open tags).
    const cut = block >= 0 && guideIdx - block < 2000 ? block : guideIdx;
    out = out.slice(0, cut);
  }

  // 3) Internal ad note for meta-ads-only products.
  out = out.replace(/META\s+ADS\s+ONLY[\s\S]*?TOKOPEDIA\s*\)/gi, "");

  // 4) Normalise pasted-Google-Docs markup: drop inline styles and direction
  //    attributes so the text adopts the site typography, and collapse &nbsp;.
  out = out.replace(/\s+style\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\s+style\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\s+dir\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/(?:&nbsp;\s*)+/gi, " ");

  // 5) Seller-internal "marketing kit" references (buyers have no access):
  //    drop the sentence(s) that mention it. A standalone note leaves an
  //    empty block behind, which step 6 removes.
  out = out.replace(
    /(?<=^|>|[.!?:]\s)(?:(?![.!?:])[^<])*marketing[\s-]*kit(?:(?![.!?])[^<])*[.!?]?/gi,
    ""
  );

  // 6) Empty paragraphs/list items and decorative separator lines.
  out = out.replace(/<(p|li|div)[^>]*>\s*(?:<br\s*\/?\s*>)*\s*<\/\1>/gi, "");
  out = out.replace(/<(p|div)[^>]*>\s*[=_\-]{4,}\s*<\/\1>/gi, "");

  out = out.trim();

  // 7) If it still looks like a captured whole page, don't show it.
  if (out.length > 200_000) return "";

  // 8) Page-UI junk detection — the scrape captured a checkout/CSS block
  //    instead of a product description.
  if (
    /Add\s*Checkout\s*Form|Pilih\s*Varian|window\.detailFlash|\.wrv-|<\/style>/i.test(out)
  ) {
    return "";
  }

  return out;
}

export type AnekaProduct = {
  id: string;
  name: string;
  image: string;
  location: string;
  rekomendasiJual: string;
  hargaModal: string;
  hargaModalCut: string;
  terjual: string;
  stok: string;
  profit: string;
};

export type AnekaQuery = {
  search?: string;
  category?: string;
  location?: string;
  seller?: string;
  page?: number;
};

export type AnekaCategory = {
  name: string;
  slug: string;
};

export type AnekaVariant = {
  id: string;
  /** Label varian gabungan (mis. "BLACK - S"). */
  name: string;
  /** Nilai axis warna (null jika supplier tidak memisahkan). */
  color: string | null;
  /** Nilai axis ukuran (null jika supplier tidak memisahkan). */
  size: string | null;
  /** Harga MODAL varian (yang dibayar dropshipper, mis. "40000.00").
   *  BUKAN harga jual — harga jual produk ada di rekomendasiJual. */
  price: string;
  /** Field hpp di JSON supplier — saat ini selalu null (tidak terpakai). */
  hpp: string;
  /** Stok varian (number). */
  stock: number;
  /** Apakah varian aktif dijual. */
  isActive: boolean;
};

export type AnekaProductDetail = {
  id: string;
  name: string;
  images: string[];
  descriptionHtml: string;
  rekomendasiJual: string;
  hargaModal: string;
  stok: string;
  terjual: string;
  profit: string;
  /** SKU asli dari anekadropship (mis. "SKU-RAVBUSRE"). */
  sku: string;
  /** Teks berat mentah dari halaman produk (mis. "500.00 Gram"). */
  berat: string;
  /** Berat dalam gram (untuk hitung ongkir). null jika tidak bisa diparse. */
  beratGram: number | null;
  /** Teks volume mentah (mis. "7 x 7 x 23 CM"). */
  volume: string;
  /** Teks ekspedisi mentah (mis. "JNE, JNT, Lion, SiCepat, SAP, ID Express, SPX"). */
  ekspedisi: string;
  /** Daftar ekspedisi terpisah (["JNE", "JNT", ...]). */
  ekspedisiList: string[];
  /** Sistem pengiriman anekadropship (mis. "Pickup"). */
  sistem: string;
  /** Alamat penjual/gudang tempat barang dikirim. */
  alamatSeller: string;
  /** Apakah produk punya varian (warna/ukuran). */
  hasVariants: boolean;
  /** Daftar varian produk (kosong jika tanpa varian). */
  variants: AnekaVariant[];
};

export class AnekaClient {
  private cookie = "";
  private loggedIn = false;
  /** Antrian login bersama: request paralel hanya memicu SATU proses login. */
  private loginPromise: Promise<void> | null = null;

  /** Merge Set-Cookie headers into a single Cookie header. */
  private grab(res: Response) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      // replace existing cookie with the same name, then append
      this.cookie = this.cookie.replace(new RegExp(`${name}=[^;]*;?`), "") + pair + "; ";
    }
  }

  /** Standard Laravel form login (CSRF via hidden _token). */
  async login(email: string, password: string) {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Mulai dengan cookie jar BERSIH: cookie lama (termasuk cookie
        // Cloudflare yang kedaluwarsa/konflik) bisa membuat POST /login
        // kena challenge → redirect balik ke /login.
        this.cookie = "";
        const page = await fetch(`${BASE}/login`, { redirect: "manual" });
        this.grab(page);
        const pageText = await page.text();
        const $ = cheerio.load(pageText);
        const token = $('input[name="_token"]').attr("value") ?? "";

        // Halaman challenge Cloudflare tidak berisi form login (token kosong).
        if (!token) {
          throw new Error("Halaman login tanpa token CSRF (kemungkinan challenge Cloudflare)");
        }

        const res = await fetch(`${BASE}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
          },
          body: new URLSearchParams({ _token: token, email, password }),
          redirect: "manual",
        });
        this.grab(res);
        // 419 = CSRF "Page Expired"; 3xx back to /login = rejected credentials
        // (atau challenge Cloudflare). Keduanya dianggap login gagal.
        const location = res.headers.get("location") ?? "";
        const failed =
          res.status === 419 ||
          (res.status >= 300 && res.status < 400 && location.includes("/login"));
        if (!failed) {
          this.loggedIn = true;
          return;
        }
        lastErr = new Error("Login anekadropship gagal (kredensial ditolak atau sesi terblokir)");
      } catch (e) {
        lastErr = e;
      }
      // Jeda sebelum percobaan berikutnya (hindari throttle login Laravel).
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Login anekadropship gagal");
  }

  async ensureLoggedIn() {
    if (this.loggedIn && this.cookie) return;
    const email = process.env.ANEKA_EMAIL;
    const password = process.env.ANEKA_PASSWORD;
    if (!email || !password) {
      throw new Error("ANEKA_EMAIL / ANEKA_PASSWORD env vars are not set");
    }
    // Serialisasi login: beberapa request API paralel tidak boleh login
    // bersamaan. Login paralel memicu race CSRF — token dari GET yang satu
    // dikirim bersama cookie sesi dari GET lain → 419 "Page Expired".
    if (!this.loginPromise) {
      this.loginPromise = this.login(email, password)
        .catch((e) => {
          this.resetSession();
          throw e;
        })
        .finally(() => {
          this.loginPromise = null;
        });
    }
    await this.loginPromise;
  }

  /** Reset sesi login agar login ulang dengan sesi segar. */
  resetSession() {
    this.cookie = "";
    this.loggedIn = false;
  }

  async getProducts(query: AnekaQuery) {
    const html = await this.fetchHome(query);
    return {
      products: this.parseProducts(html),
      totalPages: this.parseTotalPages(html, Math.max(1, query.page ?? 1)),
    };
  }

  /**
   * Scrape the "Semua Produk / Terbaru" page (newest products first).
   * This page has no category filter select, so it needs its own check.
   */
  async getNewestProducts(query: AnekaQuery) {
    const page = Math.max(1, query.page ?? 1);
    const url = `${BASE}/produk/semua/terbaru?page=${page}`;
    let html = await this.doFetch(url);

    if (!this.isValidProductPage(html)) {
      if (this.isLoginPage(html)) {
        // Session expired → re-login once and retry.
        this.loggedIn = false;
        this.cookie = "";
        await this.ensureLoggedIn();
        html = await this.doFetch(url);
      } else {
        // Transient upstream error (522 / timeout / maintenance): retry with
        // backoff WITHOUT destroying the current session.
        for (let attempt = 0; attempt < 3 && !this.isValidProductPage(html); attempt++) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          html = await this.doFetch(url);
        }
      }
    }
    if (!this.isValidProductPage(html)) {
      throw new Error("Gagal memuat halaman produk terbaru dari anekadropship.id");
    }
    return {
      products: this.parseProducts(html),
      totalPages: this.parseTotalPages(html, page),
    };
  }

  /** Scrape the full category list from the home page filter dropdown. */
  async getCategories(): Promise<AnekaCategory[]> {
    const html = await this.fetchHome({});
    const $ = cheerio.load(html);
    const cats: AnekaCategory[] = [];
    const seen = new Set<string>();
    $('select[name="category"] option').each((_, el) => {
      const value = $(el).attr("value") ?? "";
      if (!value || value === "all") return;
      const key = value.toLowerCase().replace(/\s+/g, " ").trim();
      const slug = CATEGORY_ALIASES[key] ?? value.trim();
      if (seen.has(slug)) return;
      seen.add(slug);
      const name = CATEGORY_DISPLAY[slug] ?? titleCaseCategory(slug);
      cats.push({ name, slug });
    });
    return cats;
  }

  /** Scrape a single product detail page (title, images, description, price). */
  async getProductDetail(id: string): Promise<AnekaProductDetail> {
    await this.ensureLoggedIn();
    const url = `${BASE}/products/${id}`;
    let html = await this.doFetch(url);
    if (html.includes("Login ke akun Anda")) {
      this.loggedIn = false;
      this.cookie = "";
      await this.ensureLoggedIn();
      html = await this.doFetch(url);
    }
    return this.parseProductDetail(id, html);
  }

  private parseProductDetail(id: string, html: string): AnekaProductDetail {
    const $ = cheerio.load(html);
    const name = cleanProductName($("h1").first().text());

    const images: string[] = [];
    $('img[src*="/uploads/products"]').each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (src && !images.includes(src)) images.push(src);
    });

    // Varian produk disimpan di atribut Alpine x-data="productActionDetail(...)"
    // sebagai JSON ter-encode HTML. Format argumen:
    //   productActionDetail(paymentId, productId, {productData}, basePrice, barcode, diskon)
    const variants = this.parseVariants(html);


    const descriptionHtml = cleanDescription($(".deskripsi-produk").first().html() ?? "");

    const extractAfter = (label: string, stops: string[] = []): string => {
      let val = "";
      $("span, div, p, td").each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, " ");
        if (t.length < 60 && t.includes(label)) {
          val = t.split(label)[1]?.trim() ?? "";
          for (const s of stops) {
            if (val.includes(s)) val = val.split(s)[0].trim();
          }
          return false;
        }
      });
      return val;
    };

    const berat = extractAfter("Berat:");
    const volume = extractAfter("Volume:");
    const ekspedisi = extractAfter("Ekspedisi:");
    const ekspedisiList = ekspedisi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const sistem = extractAfter("Sistem:");
    const sku = $("[data-sku]").first().attr("data-sku") ?? "";
    const alamatSeller = $("[data-address]").first().attr("data-address") ?? "";

    return {
      id,
      name,
      images,
      descriptionHtml,
      rekomendasiJual: extractAfter("Harga Jual:"),
      hargaModal: extractAfter("Harga Modal:"),
      stok: extractAfter("Stok:", ["•", "Terjual"]),
      terjual: extractAfter("Terjual:", ["•", "Stok"]),
      profit: "",
      sku,
      berat,
      beratGram: parseWeightToGram(berat),
      volume,
      ekspedisi,
      ekspedisiList,
      sistem,
      alamatSeller,
      hasVariants: variants.length > 0,
      variants,
    };
  }

  /**
   * Ekstrak daftar varian dari JSON productActionDetail di halaman produk.
   * Return array kosong jika produk tidak punya varian / gagal parse.
   */
  private parseVariants(html: string): AnekaVariant[] {
    const m = html.match(/x-data="productActionDetail\(([^"]+)\)"/);
    if (!m) return [];
    const clean = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<");
    const braceStart = clean.indexOf("{");
    const braceEnd = clean.lastIndexOf("}");
    if (braceStart < 0 || braceEnd <= braceStart) return [];
    type VariantRaw = {
      id?: unknown;
      name?: unknown;
      label?: unknown;
      color?: unknown;
      size?: unknown;
      price?: unknown;
      hpp?: unknown;
      stock?: unknown;
      is_active?: unknown;
    };
    let productData: { variants?: VariantRaw[] };
    try {
      productData = JSON.parse(clean.slice(braceStart, braceEnd + 1)) as {
        variants?: VariantRaw[];
      };
    } catch {
      return [];
    }
    const raw: VariantRaw[] = Array.isArray(productData?.variants) ? productData.variants : [];
    return raw.map((v) => ({
      id: String(v?.id ?? ""),
      name: String(v?.name ?? v?.label ?? "").trim(),
      color: v?.color == null ? null : String(v.color).trim(),
      size: v?.size == null ? null : String(v.size).trim(),
      price: String(v?.price ?? ""),
      hpp: String(v?.hpp ?? ""),
      stock: Number(v?.stock ?? 0),
      isActive: v?.is_active !== false,
    }));
  }

  private async fetchHome(query: AnekaQuery) {
    await this.ensureLoggedIn();
    const qs = new URLSearchParams({
      search: query.search ?? "",
      category: query.category ?? "",
      location: query.location ?? "all",
      seller: query.seller ?? "all",
      page: String(query.page ?? 1),
    });
    const url = `${BASE}/user/home?${qs}`;

    let html = await this.doFetch(url);
    if (this.isInvalidHome(html)) {
      if (this.isLoginPage(html)) {
        // Session expired → re-login once and retry.
        this.loggedIn = false;
        this.cookie = "";
        await this.ensureLoggedIn();
        html = await this.doFetch(url);
      } else {
        // Transient upstream error: retry with backoff, keep the session.
        for (let attempt = 0; attempt < 3 && this.isInvalidHome(html); attempt++) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          html = await this.doFetch(url);
        }
      }
    }
    // Still invalid after retry → surface a real error instead of returning an
    // empty product list (which would make the store look like it has no items).
    if (this.isInvalidHome(html)) {
      throw new Error("Gagal memuat halaman produk dari anekadropship.id");
    }
    return html;
  }

  /** A valid /user/home page always has the category filter select. */
  private isInvalidHome(html: string): boolean {
    return this.isLoginPage(html) || !html.includes('name="category"');
  }

  /**
   * True when the response is an unauthenticated page: either the login form
   * itself ("Login ke akun Anda") or a redirect stub back to /login.
   */
  private isLoginPage(html: string): boolean {
    return (
      html.includes("Login ke akun Anda") ||
      html.includes("Redirecting to https://anekadropship.id/login")
    );
  }

  /**
   * A valid product listing page has product cards. Works for /produk/semua/terbaru
   * (absolute hrefs like https://anekadropship.id/products/2229).
   */
  private isValidProductPage(html: string): boolean {
    return (
      !this.isLoginPage(html) &&
      /href="(?:https:\/\/anekadropship\.id)?\/products\/\d+/.test(html)
    );
  }

  private async doFetch(url: string) {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Abort requests that hang — upstream has been known to stall.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const res = await fetch(url, {
            headers: { Cookie: this.cookie },
            signal: controller.signal,
          });
          return await res.text();
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Network error saat mengakses anekadropship.id");
  }

  parseProducts(html: string): AnekaProduct[] {
    // A category/search with no results shows an empty-state box followed by a
    // "recommended products" section. Don't scrape that section as the result.
    if (/tidak ada produk/i.test(html)) return [];

    // The main results grid is followed by a "Cuan Besar di Meta Ads" section
    // (marked by meta_ads.png). Only scrape the part before it so recommended
    // products don't leak into the category/search results.
    const adsIdx = html.indexOf("meta_ads.png");
    const resultsHtml = adsIdx >= 0 ? html.slice(0, adsIdx) : html;

    const $ = cheerio.load(resultsHtml);
    const items: AnekaProduct[] = [];
    const seen = new Set<string>();

    $('a.line-clamp-2[href*="/products/"]').each((_, el) => {
      const a = $(el);
      const card = a.closest("div.group");
      const href = a.attr("href") ?? "";
      const id = href.match(/\/products\/(\d+)/)?.[1] ?? "";
      const image = card.find("img").first().attr("src") ?? "";

      // Skip duplicate ids (products rendered in multiple sections) and
      // cards without a proper product image (secondary/related sections).
      if (!id || seen.has(id) || !image) return;
      seen.add(id);

      items.push({
        id,
        name: cleanProductName(a.text()),
        image,
        location: card.find("div.absolute span.truncate").first().text().trim(),
        rekomendasiJual: card
          .find('span:contains("Rekomendasi Jual")')
          .parent()
          .find("span.text-green-600")
          .first()
          .text()
          .trim(),
        hargaModalCut: card.find("span.line-through").first().text().trim(),
        hargaModal: card.find("span.text-red-500").first().text().trim(),
        terjual: card
          .find('span:contains("Terjual")')
          .parent()
          .find("span.font-bold")
          .last()
          .text()
          .trim(),
        stok: card.find('span:contains("Stok:")').find("span").last().text().trim(),
        profit: card.find("span.bg-orange-100").first().text().trim(),
      });
    });

    return items;
  }

  /**
   * Hitung total halaman dari pagination nav. Nav anekadropship kini hanya
   * menampilkan jendela (halaman aktif ± 1-2) TANPA tautan ke halaman akhir,
   * jadi jika masih ada tautan rel="next", totalPages minimal = halaman aktif + 1
   * (nilai akan "bertumbuh" seiring pengguna membuka halaman berikutnya,
   * sehingga semua halaman tetap bisa dijelajahi).
   */
  parseTotalPages(html: string, currentPage: number): number {
    const $ = cheerio.load(html);
    let max = currentPage;
    $('nav[aria-label="Pagination Navigation"] a[href*="page="]').each((_, el) => {
      const m = $(el).attr("href")?.match(/page=(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const hasNext = $('nav[aria-label="Pagination Navigation"] a[rel="next"]').length > 0;
    if (hasNext) max = Math.max(max, currentPage + 1);
    return max;
  }
}

export const anekaClient = new AnekaClient();
