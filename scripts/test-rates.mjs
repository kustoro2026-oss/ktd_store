// Tes cepat API rates: cari kecamatan tujuan Jakarta Barat, lalu hitung ongkir
// untuk produk 1042 (origin harus berasal dari lokasi seller, bukan env global).
const BASE = "http://localhost:3000";

const get = async (path) => (await fetch(BASE + path)).json();
const post = async (path, body) =>
  (await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })).json();

const prov = await get("/api/shipping/provinces");
console.log("provinces:", JSON.stringify(prov).slice(0, 300));

// Jalur productId: detail produk di-scrape + origin di-resolve, lalu KA dipanggil.
const r1 = await post("/api/shipping/rates", {
  destination: 9999,
  itemValue: 49000,
  productId: "1042",
});
console.log("\nSingle product (1042):");
console.log(JSON.stringify(r1, null, 2).slice(0, 400));

// Produk tidak ada -> pesan error spesifik.
const r2 = await post("/api/shipping/rates", {
  destination: 9999,
  itemValue: 100000,
  productIds: ["1042", "999999"],
});
console.log("\nCart (1042 + produk tak ada):");
console.log(JSON.stringify(r2, null, 2).slice(0, 400));

const r3 = await post("/api/shipping/rates", {
  destination: 9999,
  itemValue: 100000,
  productIds: ["1042", "1398"],
});
console.log("\nCart (1042 + 1398):");
console.log(JSON.stringify(r3, null, 2).slice(0, 400));
