// Scrape halaman dokumentasi KiriminAja API
async function get(url) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    return html;
}

async function main() {
    console.log("=== Scrape developer.kiriminaja.com ===\n");

    // Ambil halaman utama docs
    const home = await get("https://developer.kiriminaja.com/");

    // Cari link-link dokumentasi API
    const links = home.match(/href="([^"]*api[^"]*)"/gi) || [];
    console.log("API links found:", links.length);
    links.slice(0, 30).forEach(l => console.log(" ", l));

    // Cari section title dan endpoint
    const titles = home.match(/<title[^>]*>([^<]+)<\/title>/i);
    console.log("\nPage title:", titles?.[1]);

    // Cari teks yang menyebut "endpoint", "API", "order", "waybill", "resi"
    const keywords = ["order", "waybill", "resi", "awb", "booking", "pickup", "create", "print", "label"];
    for (const kw of keywords) {
        const re = new RegExp(kw, "gi");
        const matches = home.match(re);
        if (matches) console.log(`"${kw}" found: ${matches.length}x`);
    }

    // Print snippet sekitar kata "order"
    const orderIdx = home.toLowerCase().indexOf("order");
    if (orderIdx > -1) {
        console.log("\n--- Context around 'order' ---");
        console.log(home.slice(Math.max(0, orderIdx - 200), orderIdx + 400));
    }

    // Coba fetch halaman API reference
    console.log("\n=== Fetch API Reference pages ===");
    const pages = [
        "https://developer.kiriminaja.com/api-reference",
        "https://developer.kiriminaja.com/docs",
        "https://developer.kiriminaja.com/guide",
        "https://developer.kiriminaja.com/api",
    ];
    for (const p of pages) {
        try {
            const r = await fetch(p, { headers: { "User-Agent": "Mozilla/5.0" } });
            console.log(`${r.status} ${p} (${(await r.text()).length} bytes)`);
        } catch (e) {
            console.log(`ERR ${p}: ${e.message.slice(0, 50)}`);
        }
    }
}

main();