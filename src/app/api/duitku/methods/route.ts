// Daftar metode pembayaran Duitku yang aktif — dipakai picker kanal di modal
// checkout (baris QRIS / Transfer Bank dengan logo resmi gateway). Hasil
// di-cache in-memory 10 menit di src/lib/duitku.ts.
import { NextResponse } from "next/server";
import {
  duitkuConfigured,
  getDuitkuPaymentMethods,
  DUITKU_MIN_AMOUNT,
  vaSafeForGross,
  vaMinSellForCategory,
} from "@/lib/duitku";
import { TOPUP_PRODUCTS } from "@/lib/topup";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!duitkuConfigured()) {
    return NextResponse.json({ ok: false, methods: [] });
  }
  const url = new URL(req.url);
  const amount = Number(url.searchParams.get("amount")) || DUITKU_MIN_AMOUNT;
  const sku = String(url.searchParams.get("sku") ?? "").trim();
  try {
    const methods = await getDuitkuPaymentMethods(amount);
    // Penanda untuk picker top-up: vaEnabled = saklar global env
    // TOPUP_VA_ENABLED; vaAllowed = VA diizinkan untuk SKU nominal terpilih
    // (selain saklar, margin kotor harus menutup fee flat VA — VA_MIN_GROSS);
    // vaMinSell = harga jual minimal untuk pembayaran online (pesan info).
    // Checkout produk fisik tidak membaca penanda ini — hanya NominalPicker.
    const vaEnabled = process.env.TOPUP_VA_ENABLED === "true";
    let vaAllowed = vaEnabled;
    let vaMinSell: number | null = null;
    if (sku) {
      const product = TOPUP_PRODUCTS.find((p) => p.sku === sku);
      if (product) {
        vaAllowed = vaEnabled && vaSafeForGross(product.sellPrice, product.costPrice);
        vaMinSell = vaMinSellForCategory(product.category);
      } else {
        // SKU tidak dikenal — jangan izinkan VA (berhati-hati).
        vaAllowed = false;
      }
    }
    return NextResponse.json({ ok: true, methods, vaEnabled, vaAllowed, vaMinSell });
  } catch (e) {
    console.error("GET /api/duitku/methods error:", e);
    return NextResponse.json({ ok: false, methods: [] });
  }
}
