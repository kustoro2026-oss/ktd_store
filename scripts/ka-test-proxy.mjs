// Tes Cloudflare Worker proxy yang sudah di-deploy.
const WORKER_URL = "https://odd-snowflake-8ffd.kustoroterbatas.workers.dev";
const API_KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";

async function test(label, path, body = {}) {
    try {
        const res = await fetch(`${WORKER_URL}${path}`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        console.log(text.slice(0, 500));
        return { status: res.status, text };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Tes Cloudflare Worker Proxy ===\n");
    console.log("Worker URL:", WORKER_URL);

    // 1. Tes GET (harusnya ditolak, hanya POST)
    try {
        const res = await fetch(WORKER_URL);
        console.log(`\n== GET / (HTTP ${res.status}) ==`);
        console.log(await res.text());
    } catch (e) {
        console.log("GET / FAILED:", e.message);
    }

    // 2. Tes POST /api/mitra/province (endpoint ringan)
    await test("POST /api/mitra/province", "/api/mitra/province");

    // 3. Tes POST /api/mitra/city
    await test("POST /api/mitra/city (Jakarta Pusat=160)", "/api/mitra/city", { provinsi_id: 6 });

    // 4. Tes POST /api/mitra/v6.1/shipping_price
    await test(
        "POST /api/mitra/v6.1/shipping_price",
        "/api/mitra/v6.1/shipping_price",
        { origin: 5783, destination: 5783, weight: 1000 }
    );
}

main();