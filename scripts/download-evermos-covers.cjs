/**
 * download-evermos-covers.cjs — Unduh gambar cover seluruh produk Evermos ke folder situs.
 *
 * Input : evermos-scrape/evermos-products.json
 * Output: public/images/evm-products/EVM-<modelId>-<slug>-0-hd.<ext>  (gambar cover)
 *         src/lib/evermos-images.json           — peta id EVM -> path lokal (ala product-images.json aneka)
 *         evermos-export/products-cache.json    — field "image" diisi path lokal (finalisasi)
 *
 * Varian CDN: coverImage di data scrape bertipe /public/thumbnail/ (200 px, buram). Skrip ini
 *        mentransformnya ke /public/original/q:100/ agar resolusi penuh (permintaan user 26 Sep 2026).
 *
 * Sufiks "-0-hd": penanda byte versi resolusi penuh sekaligus cache-bust. Byte gambar pada nama
 *        file yang sama jangan ditimpa — browser meng-cache /images/* dgn header immutable 1 tahun.
 *        Bila kualitas naik lagi, naikkan sufiks (mis. -0-hd2), jangan timpa nama lama.
 *
 * Fitur: lanjut dari checkpoint (evermos-export/.tmp-covers.json), lewati file yang sudah ada,
 *        retry 3x per gambar, konkurensi 6, nama file memuat kode EVM + slug agar mudah dikenali.
 *
 * Pakai: node scripts/download-evermos-covers.cjs            (unduh yang belum ada)
 *        node scripts/download-evermos-covers.cjs --force    (unduh ulang semua utk upgrade kualitas;
 *                                                             resume via evermos-export/.tmp-covers-hd.json)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_FILE = path.join(ROOT, "evermos-scrape", "evermos-products.json");
const SITE_DIR = path.join(ROOT, "public", "images", "evm-products");
const MAP_FILE = path.join(ROOT, "src", "lib", "evermos-images.json");
const CACHE_FILE = path.join(ROOT, "evermos-export", "products-cache.json");
const CKPT_FILE = path.join(ROOT, "evermos-export", ".tmp-covers.json");
const HD_CKPT_FILE = path.join(ROOT, "evermos-export", ".tmp-covers-hd.json");
const FORCE = process.argv.includes("--force");

const CONCURRENCY = 6;
const MAX_RETRY = 3;
const EXT_BY_TYPE = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function slugClean(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

async function downloadOne(item, state) {
  const url = String(item.coverImage || "").replace("/public/thumbnail/", "/public/original/");
  if (!url) {
    state.fail += 1;
    state.errors.push(item.code + ": coverImage kosong");
    return;
  }
  const base = "EVM-" + item.modelId + (item.slug ? "-" + slugClean(item.slug) : "");

  for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      let ext = EXT_BY_TYPE[(res.headers.get("content-type") || "").split(";")[0].trim()] || "";
      if (!ext) {
        const m = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(new URL(url).pathname);
        ext = m ? m[1].toLowerCase() : "jpg";
      }
      const file = base + "-0-hd." + ext;
      const rel = "/images/evm-products/" + file;
      const prev = state.map[item.code];
      if (FORCE && prev && prev[0] && prev[0] !== rel) {
        try { fs.unlinkSync(path.join(ROOT, "public", prev[0])); } catch (e) {}
      }
      fs.writeFileSync(path.join(SITE_DIR, file), buf);
      state.map[item.code] = [rel];
      if (FORCE) state.hdDone[item.code] = buf.length;
      state.ok += 1;
      return;
    } catch (e) {
      if (attempt === MAX_RETRY) {
        state.fail += 1;
        state.errors.push(item.code + ": " + e.message);
      } else {
        await new Promise(function (r) {
          setTimeout(r, 800 * attempt);
        });
      }
    }
  }
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  const products = (raw.products || []).filter(function (p) {
    return p.coverImage;
  });

  if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR, { recursive: true });

  const state = { ok: 0, fail: 0, skip: 0, map: {}, errors: [], hdDone: {} };
  if (fs.existsSync(CKPT_FILE)) {
    try {
      const c = JSON.parse(fs.readFileSync(CKPT_FILE, "utf8"));
      state.map = c.map || {};
      console.log("[covers] lanjut dari checkpoint: " + Object.keys(state.map).length + " entri");
    } catch (e) {
      console.warn("[covers] checkpoint rusak, mulai dari awal");
    }
  }
  if (FORCE && fs.existsSync(HD_CKPT_FILE)) {
    try {
      const h = JSON.parse(fs.readFileSync(HD_CKPT_FILE, "utf8"));
      state.hdDone = h.done || {};
      console.log("[covers] mode --force: " + Object.keys(state.hdDone).length + " gambar sudah versi HD");
    } catch (e) {
      console.warn("[covers] checkpoint HD rusak, mulai dari awal");
    }
  }

  const todo = [];
  for (const p of products) {
    const code = p.code || "EVM-" + p.modelId;
    const rel = state.map[code];
    const ada = rel && rel[0] && fs.existsSync(path.join(ROOT, "public", rel[0]));
    if (!FORCE && ada) {
      state.skip += 1;
      continue;
    }
    if (FORCE && ada && state.hdDone[code]) {
      state.skip += 1;
      continue;
    }
    todo.push({ code: code, modelId: p.modelId, slug: p.slug, coverImage: p.coverImage });
  }
  console.log("[covers] total " + products.length + ", skip " + state.skip + ", antre " + todo.length);

  let idx = 0;
  let lastCkpt = state.ok + state.fail + state.skip;
  async function worker() {
    while (idx < todo.length) {
      const mine = todo[idx];
      idx += 1;
      await downloadOne(mine, state);
      const done = state.ok + state.fail + state.skip;
      if (done - lastCkpt >= 50) {
        lastCkpt = done;
        fs.writeFileSync(CKPT_FILE, JSON.stringify({ map: state.map, ok: state.ok, fail: state.fail }));
        if (FORCE) fs.writeFileSync(HD_CKPT_FILE, JSON.stringify({ done: state.hdDone }));
        console.log("[covers] " + done + "/" + products.length + " (gagal " + state.fail + ")");
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = {};
  Object.keys(state.map)
    .sort()
    .forEach(function (k) {
      sorted[k] = state.map[k];
    });

  fs.writeFileSync(CKPT_FILE, JSON.stringify({ map: sorted, ok: state.ok, fail: state.fail }));
  if (FORCE) fs.writeFileSync(HD_CKPT_FILE, JSON.stringify({ done: state.hdDone }));
  fs.writeFileSync(MAP_FILE, JSON.stringify(sorted));

  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    let patched = 0;
    for (const p of cache.products || []) {
      const loc = sorted[p.id];
      if (loc && loc[0]) {
        p.image = loc[0];
        patched += 1;
      }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    console.log("[covers] products-cache dipatch: " + patched + " image lokal");
  } catch (e) {
    console.warn("[covers] patch products-cache dilewati: " + e.message);
  }

  try {
    const SITE_CACHE = path.join(ROOT, "src", "lib", "evermos-products-cache.json");
    const sc = JSON.parse(fs.readFileSync(SITE_CACHE, "utf8"));
    let sp = 0;
    for (const p of sc.products || []) {
      const loc = sorted[p.id];
      if (loc && loc[0] && p.image !== loc[0]) {
        p.image = loc[0];
        if (Array.isArray(p.images) && p.images.length) p.images = [loc[0]];
        sp += 1;
      }
    }
    if (sp > 0) {
      fs.writeFileSync(SITE_CACHE, JSON.stringify(sc));
      console.log("[covers] site cache dipatch: " + sp + " image");
    }
  } catch (e) {
    console.warn("[covers] patch site cache dilewati: " + e.message);
  }

  console.log("[covers] selesai" + (FORCE ? " (mode --force/HD)" : "") + ": ok " + state.ok + ", gagal " + state.fail + ", skip " + state.skip + " dari " + products.length);
  if (state.errors.length) {
    console.log("[covers] contoh error:");
    state.errors.slice(0, 10).forEach(function (e) {
      console.log("  " + e);
    });
  }
}

main().catch(function (e) {
  console.error("[covers] fatal: " + e.stack);
  process.exit(1);
});
