// Token produk WA-only (parfum line-alikes yang ditolak Blibli karena HKI).
// SALINAN dari src/lib/config.ts (WA_ONLY_TOKENS + isWaOnlyProduct) untuk
// script Node CommonJS yang tidak bisa meng-import TypeScript. Jaga tetap
// sinkron bila daftar di src/lib/config.ts berubah.
const WA_ONLY_TOKENS = [
    "cahnxl", // Parfum Wanita Cahnxl 5 100ML
    "op1um", // Parfum Wanita OP1UM RED 90ml
    "invictus", // Parfum Pria PR Invictus 100ml
    "b4cca", // Parfum Unisex Red B4CCA 70ml
    "aqkva", // Parfum Pria Bxlgar1 Aqkva 100ML
    "gold ribbon", // Parfum Y5L Wanita Premium Gold Ribbon 100ml
    "jennifer lopez", // Parfum Wanita Jennifer Lopez Still 100ml
    "zara oriental", // Parfum Wanita ZARA Oriental 90ml
    "gucci", // Parfum Gucci Guilty Gold & Parfum Gucci Pink Floral 100ml
];

/** True bila nama produk adalah parfum WA-only (tidak boleh dijual di marketplace). */
function isWaOnlyName(name) {
    const key = String(name ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!key.startsWith("parfum ")) return false;
    return WA_ONLY_TOKENS.some((t) => key.includes(t));
}

module.exports = { WA_ONLY_TOKENS, isWaOnlyName };
