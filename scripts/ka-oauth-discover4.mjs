// Tes endpoint OAuth KiriminAja — round 4.
// Coba subdomain berbeda dan periksa response header dari API key yang valid.

const API_KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";

async function tryPost(label, url, body, headers = {}) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        // Print all headers
        const hdrs = {};
        res.headers.forEach((v, k) => { if (!k.startsWith("cf-") && !k.startsWith("x-") || k === "x-auth-token") hdrs[k] = v; });
        console.log("Headers:", JSON.stringify(hdrs, null, 2));
        console.log(text.slice(0, 600));
        return { status: res.status, text, headers: res.headers };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Round 4: Subdomain + API key inspection ===\n");

    // 1. Coba berbagai subdomain untuk OAuth
    const oauthUrls = [
        "https://oauth.kiriminaja.com/api/login",
        "https://auth.kiriminaja.com/api/login",
        "https://api-v2.kiriminaja.com/api/login",
        "https://apiv2.kiriminaja.com/api/login",
        "https://services.kiriminaja.com/api/login",
        "https://oauth.kiriminaja.com/oauth/token",
        "https://auth.kiriminaja.com/oauth/token",
    ];

    for (const url of oauthUrls) {
        await tryPost(`POST ${url}`, url, { email: EMAIL, password: PASSWORD });
    }

    // 2. Coba panggil API dengan API key yang valid, lihat response headers
    console.log("\n\n=== Cek response headers dari API key valid ===");

    // Test dengan sandbox dulu (no IP restriction)
    await tryPost(
        "SANDBOX /api/mitra/province (with API key)",
        "https://tdev.kiriminaja.com/api/mitra/province",
        {},
        { "Authorization": `Bearer ${API_KEY}` }
    );

    // 3. Coba dapatkan token dari dashboard KiriminAja
    console.log("\n\n=== Coba akses dashboard API ===");
    try {
        // Coba akses halaman API key management
        const res = await fetch("https://client.kiriminaja.com/api/mitra/profile", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`,
            },
            body: "{}",
        });
        const text = await res.text();
        console.log(`/api/mitra/profile (HTTP ${res.status}):`, text.slice(0, 500));
    } catch (e) {
        console.log("Gagal:", e.message);
    }

    // 4. Coba /api/mitra/me atau /api/mitra/user
    for (const path of ["/api/mitra/me", "/api/mitra/user", "/api/mitra/account"]) {
        try {
            const res = await fetch(`https://tdev.kiriminaja.com${path}`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`,
                },
                body: "{}",
            });
            const text = await res.text();
            console.log(`SANDBOX ${path} (HTTP ${res.status}):`, text.slice(0, 300));
        } catch (e) {
            console.log(`SANDBOX ${path} FAILED:`, e.message);
        }
    }
}

main();