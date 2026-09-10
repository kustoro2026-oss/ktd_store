/**
 * Debug: fetch halaman detail produk 1542 (login) dan simpan HTML mentah
 * untuk inspeksi struktur varian. Jalankan: node scripts/inspect-1542.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

loadEnv();
const BASE = "https://anekadropship.id";
let cookie = "";

function grab(res: Response) {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookie = cookie.replace(new RegExp(`${name}=[^;]*;?`), "") + pair + "; ";
  }
}

async function doFetch(url: string) {
  const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
  return res;
}

async function main() {
  const page = await fetch(`${BASE}/login`, { redirect: "manual" });
  grab(page);
  const html0 = await page.text();
  const token = (html0.match(/name="_token"\s+value="([^"]*)"/) ?? [])[1] ?? "";
  console.log("token:", token.slice(0, 10), "...");

  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({
      _token: token,
      email: process.env.ANEKA_EMAIL ?? "",
      password: process.env.ANEKA_PASSWORD ?? "",
    }),
    redirect: "manual",
  });
  grab(res);
  console.log("login status:", res.status, "| loc:", res.headers.get("location"));

  const prod = await doFetch(`${BASE}/products/1542`);
  grab(prod);
  const h = await prod.text();
  console.log("produk status:", prod.status, "| panjang:", h.length, "| login page?", h.includes("Login ke akun Anda"));
  fs.writeFileSync(path.resolve("tiktok-export/_1542.html"), h);
  console.log("tersimpan ke tiktok-export/_1542.html");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
