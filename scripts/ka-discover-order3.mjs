// Discover KiriminAja API - cek dokumentasi & base path alternatif
const PROXY = "https://charcoal-nesia.com/ka-proxy.php";
const KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";

async function get(label, url) {
    try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const text = await res.text();
        console.log(`[${res.status}] ${label}: ${text.slice(0, 400)}`);
        return text;
    } catch (e) {
        console.log(`[ERR] ${label}: ${e.message.slice(0, 80)}`);
    }
}

async function post(label, path, body = {}) {
    try {
        const res = await fetch(`${PROXY}${path}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${KEY}`,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[${res.status}] ${label}: ${text.slice(0, 400)}`);
        return text;
    } catch (e) {
        console.log(`[ERR] ${label}: ${e.message.slice(0, 80)}`);
    }
}

async function main() {
    console.log("=== KiriminAja API Discovery v3 ===\n");

    // Cek dokumentasi developer
    console.log("--- Dokumentasi ---");
    await get("developer.kiriminaja.com", "https://developer.kiriminaja.com/");
    await get("docs.kiriminaja.com", "https://docs.kiriminaja.com/");

    // Cek landing page
    console.log("\n--- Landing pages ---");
    await get("kiriminaja.com", "https://kiriminaja.com/");

    // Coba endpoint non-mitra
    console.log("\n--- Non-mitra endpoints ---");
    await post("POST /api/waybill", "/api/waybill", {});
    await post("POST /api/v1/shipping/order", "/api/v1/shipping/order", {});

    // Coba method GET pada base
    console.log("\n--- GET method tests ---");
    await get("GET /api/mitra/ via proxy", `${PROXY}/api/mitra`);

    // APAKAH mitra API hanya untuk lookup + pricing saja?
    // Mari verifikasi endpoint yang kita TAHU bekerja
    console.log("\n--- Known working endpoints ---");
    await post("✔ /api/mitra/province", "/api/mitra/province", {});
    await post("✔ /api/mitra/v6.1/shipping_price", "/api/mitra/v6.1/shipping_price", {
        origin: 5783, destination: 5783, weight: 1000
    });
}

main();