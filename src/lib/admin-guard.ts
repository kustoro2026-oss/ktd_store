// Guard bersama untuk endpoint admin toko (x-topup-secret / x-cron-secret):
// banding timing-safe + pembatasan laju per IP. Banding memakai hash sha256
// + timingSafeEqual (pola sama dengan digiflazz-webhook.ts) supaya waktu
// respons tidak membocorkan posisi karakter yang cocok — penting karena
// secret admin membuka eksekusi transaksi Digiflazz.
import { createHash, timingSafeEqual } from "crypto";
import { clientIp, rateLimitHit } from "./rate-limit";

/** Banding timing-safe dua string rahasia. */
export function secretMatch(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export type AdminGuardResult = "ok" | "rate_limited" | "forbidden";

/** Guard endpoint admin: rate limit per IP (default 30 percobaan/10 menit)
 *  lalu banding timing-safe header x-topup-secret dengan nilai env. */
export function adminGuard(
  req: Request,
  expected: string,
  max = 30,
): AdminGuardResult {
  if (!expected) return "forbidden";
  if (rateLimitHit(`admin:${clientIp(req)}`, 10 * 60_000, max)) {
    return "rate_limited";
  }
  const given = req.headers.get("x-topup-secret") ?? "";
  return secretMatch(given, expected) ? "ok" : "forbidden";
}

/** Guard route cron: terima x-cron-secret (tanpa rate limit — dipanggil
 *  Vercel Cron sekali sehari) ATAU x-topup-secret (admin, kena rate limit). */
export function cronOrAdminGuard(
  req: Request,
  cronExpected: string,
  adminExpected: string,
): AdminGuardResult {
  const givenCron = req.headers.get("x-cron-secret") ?? "";
  if (cronExpected && secretMatch(givenCron, cronExpected)) return "ok";
  const givenAdmin = req.headers.get("x-topup-secret") ?? "";
  if (!adminExpected || !givenAdmin) return "forbidden";
  if (rateLimitHit(`admin:${clientIp(req)}`, 10 * 60_000, 30)) {
    return "rate_limited";
  }
  return secretMatch(givenAdmin, adminExpected) ? "ok" : "forbidden";
}
