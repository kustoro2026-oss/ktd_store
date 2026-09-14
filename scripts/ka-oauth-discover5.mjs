// Tes endpoint OAuth KiriminAja — round 5.
// Simulasi login browser ke dashboard KiriminAja untuk dapat session cookie,
// lalu gunakan cookie tersebut untuk akses Mitra API.

const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";

async function main() {
    console.log("=== Round 5: Browser-simulated login ke KiriminAja ===\n");

    // Step 1: Dapatkan CSRF token dan cookie dari halaman login
    console.log("1. GET https://kiriminaja.com/login ...");
    const loginPageRes = await fetch("https://kiriminaja.com/login", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "manual",
    });

    const loginPageHtml = await loginPageRes.text();
    const setCookie = loginPageRes.headers.get("set-cookie") || "";
    console.log(`   HTTP ${loginPageRes.status}, cookie: ${setCookie.slice(0, 150)}`);

    // Cari CSRF token
    const csrfMatch = loginPageHtml.match(/name="_token"\s+value="([^"]*)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    console.log(`   CSRF: ${csrfToken ? csrfToken.slice(0, 30) + "..." : "NOT FOUND (mungkin SPA)"}`);

    // Cari tahu apakah ini SPA (Nuxt) atau server-rendered
    if (loginPageHtml.includes("__NUXT__") || loginPageHtml.includes("nuxt")) {
        console.log("   Ini adalah Nuxt SPA - login dilakukan client-side.");
        console.log("   Mencari API endpoint dari JS bundle...");

        // Cari API URL di HTML
        const apiMatches = loginPageHtml.match(/https:\/\/[^"']*api[^"']*/gi) || [];
        console.log("   API URLs:", apiMatches.slice(0, 5));
    }

    // Step 2: Coba login via endpoint yang digunakan oleh SPA
    // KiriminAja Nuxt frontend mungkin memanggil API backend tertentu
    console.log("\n2. Mencoba endpoint API yang mungkin digunakan SPA...");

    const possibleApiBases = [
        "https://kiriminaja.com/api/v1",
        "https://api.kiriminaja.com/api/v1",
        "https://client.kiriminaja.com/api/v1",
        "https://kiriminaja.com/api",
        "https://api.kiriminaja.com/api",
    ];

    for (const base of possibleApiBases) {
        try {
            const res = await fetch(`${base}/auth/login`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                },
                body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
            });
            const text = await res.text();
            if (res.status !== 404 && !text.includes("Page not found") && !text.includes("could not be found")) {
                console.log(`   ${base}/auth/login -> HTTP ${res.status}: ${text.slice(0, 300)}`);
            }
        } catch (e) {
            // Skip DNS errors
        }
    }

    // Step 3: Coba login ke dashboard KiriminAja (app.kiriminaja.com atau dashboard.kiriminaja.com)
    console.log("\n3. Mencoba subdomain dashboard...");
    const dashboardDomains = [
        "https://app.kiriminaja.com",
        "https://dashboard.kiriminaja.com",
        "https://member.kiriminaja.com",
        "https://account.kiriminaja.com",
    ];

    for (const domain of dashboardDomains) {
        try {
            const res = await fetch(`${domain}/api/login`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
            });
            const text = await res.text();
            console.log(`   ${domain}/api/login -> HTTP ${res.status}: ${text.slice(0, 200)}`);
        } catch (e) {
            console.log(`   ${domain} -> DNS/network error`);
        }
    }

    // Step 4: Coba dapatkan token dari halaman dashboard setelah login
    // Mungkin KiriminAja menggunakan token-based auth untuk API mereka
    console.log("\n4. Mencoba endpoint token exchange...");

    // Coba dengan API key yang ada untuk mendapatkan token baru
    const API_KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";

    try {
        const res = await fetch("https://client.kiriminaja.com/api/mitra/refresh-token", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({}),
        });
        const text = await res.text();
        console.log(`   /api/mitra/refresh-token -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    } catch (e) {
        console.log(`   refresh-token FAILED: ${e.message}`);
    }
}

main();