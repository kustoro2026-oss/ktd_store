// Uji sementara: key produksi vs base URL produksi vs endpoint live.
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^KIRIMINAJA_API_KEY=(.+)$/m)?.[1]?.trim();
const base = env.match(/^KIRIMINAJA_BASE_URL=(.+)$/m)?.[1]?.trim();
console.log("env base :", base);
console.log("key head :", key ? key.slice(0, 12) + "..." : "MISSING");

const ip = await fetch("https://api.ipify.org").then((r) => r.text());
console.log("public IP:", ip.trim());

const call = async (label, url, headers = {}, body = "{}") => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });
    const text = await res.text();
    console.log(`\n== ${label} (HTTP ${res.status}) ==\n${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`\n== ${label} FAILED ==\n${e.message}`);
  }
};

// 1. Produksi TANPA auth (lihat apakah IP-gate dulu atau key-gate dulu)
await call("PROD no-auth", "https://client.kiriminaja.com/api/mitra/province");
// 2. Produksi dengan key produksi, TANPA Origin
await call(
  "PROD key-prod TANPA Origin",
  "https://client.kiriminaja.com/api/mitra/province",
  { Authorization: `Bearer ${key}` }
);
// 2b. Produksi dengan key produksi + Origin/Referer domain
await call(
  "PROD key-prod + Origin domain",
  "https://client.kiriminaja.com/api/mitra/province",
  {
    Authorization: `Bearer ${key}`,
    Origin: "https://toko.kustoro2026.com",
    Referer: "https://toko.kustoro2026.com/",
  }
);
// 3. Sandbox TANPA auth (kontrol)
await call("SBX no-auth", "https://tdev.kiriminaja.com/api/mitra/province");
// 4. Produksi shipping_price dengan key produksi
await call(
  "PROD shipping_price key-prod",
  "https://client.kiriminaja.com/api/mitra/v6.1/shipping_price",
  { Authorization: `Bearer ${key}` },
  JSON.stringify({ origin: 5783, destination: 5783, weight: 1000 })
);

// 5. Gateway percaya XFF — coba tebak IP yang terdaftar di key produksi.
for (const cand of ["182.2.37.94", "182.2.46.252", "54.196.254.27"]) {
  await call(
    `PROD key-prod + XFF ${cand}`,
    "https://client.kiriminaja.com/api/mitra/province",
    { Authorization: `Bearer ${key}`, "X-Forwarded-For": cand }
  );
}

// Endpoint live kita hanya GET.
try {
  const res = await fetch("https://toko.kustoro2026.com/api/shipping/provinces", {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  console.log(`\n== LIVE site /api/shipping/provinces GET (HTTP ${res.status}) ==\n${text.slice(0, 500)}`);
} catch (e) {
  console.log(`\n== LIVE site GET FAILED ==\n${e.message}`);
}
