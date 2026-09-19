// Deep scrape docs.kiriminaja.com untuk endpoint API
async function main() {
    const res = await fetch("https://developer.kiriminaja.com/docs", {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();

    // Cari semua teks yang terlihat (strip HTML tags sederhana)
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // Cari endpoint patterns
    const endpoints = text.match(/\/api\/[a-zA-Z0-9_\/.-]+/g) || [];
    const unique = [...new Set(endpoints)];
    console.log("=== API Endpoints found in docs ===");
    unique.forEach(e => console.log(" ", e));

    // Cari keyword penting
    console.log("\n=== Keyword analysis ===");
    const kws = ["create order", "waybill", "resi", "awb", "booking", "pickup",
        "cetak", "print", "download", "label", "pengiriman", "shipment",
        "cod", "manifest", "tracking", "status"];
    for (const kw of kws) {
        const count = (text.toLowerCase().match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        if (count > 0) console.log(`  "${kw}": ${count}x`);
    }

    // Cari section tentang "Order"
    console.log("\n=== Sections mentioning 'order' ===");
    const orderSections = html.split(/<h[23][^>]*>/i);
    orderSections.forEach((s, i) => {
        if (s.toLowerCase().includes("order") && s.length < 2000) {
            console.log(`\n--- Section ${i} ---`);
            console.log(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500));
        }
    });
}

main();