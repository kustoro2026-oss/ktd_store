// Tes endpoint OAuth KiriminAja — round 7.
// Gunakan API backend dashboard: prd-kaj-srvc-dshbd-api-ext.kiriminaja.com/api/dm

const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const API_BASE = "https://prd-kaj-srvc-dshbd-api-ext.kiriminaja.com";

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
        const hdrs = {};
        res.headers.forEach((v, k) => {
            if (["set-cookie", "authorization", "x-auth-token", "content-type", "x-csrf-token"].includes(k)) hdrs[k] = v;
        });
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        if (Object.keys(hdrs).length) console.log("Headers:", JSON.stringify(hdrs, null, 2));
        console.log(text.slice(0, 600));
        return { status: res.status, text, headers: res.headers };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Round 7: Dashboard API backend ===\n");

    // 1. Coba berbagai path login di API backend dashboard
    const loginPaths = [
        "/api/dm/auth/login",
        "/api/dm/login",
        "/api/dm/v1/auth/login",
        "/api/dm/v1/login",
        "/api/dm/oauth/token",
        "/api/auth/login",
        "/api/login",
        "/api/v1/auth/login",
        "/api/v1/login",
        "/api/oauth/token",
    ];

    for (const path of loginPaths) {
        await tryPost(
            `POST ${path}`,
            `${API_BASE}${path}`,
            { email: EMAIL, password: PASSWORD }
        );
    }

    // 2. Coba dengan grant_type password (OAuth2 standard)
    await tryPost(
        "POST /api/dm/oauth/token (grant_type=password)",
        `${API_BASE}/api/dm/oauth/token`,
        { grant_type: "password", username: EMAIL, password: PASSWORD, client_id: "2" }
    );

    // 3. Coba dengan form-urlencoded
    console.log("\n\n=== Form-urlencoded attempts ===");
    for (const path of ["/api/dm/auth/login", "/api/dm/login", "/api/auth/login"]) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString(),
            });
            const text = await res.text();
            console.log(`${path} (form) -> HTTP ${res.status}: ${text.slice(0, 400)}`);
        } catch (e) {
            console.log(`${path} FAILED: ${e.message}`);
        }
    }

    // 4. Coba akses JS bundle untuk cari endpoint login
    console.log("\n\n=== Mencari endpoint login di JS bundle ===");
    try {
        const res = await fetch("https://kaj-prd-dshbd-v2-assets.kiriminaja.com/public/deployment/v3.17.0/html/_nuxt/D6XC3nVW.js");
        const js = await res.text();
        // Cari pattern login
        const loginPatterns = js.match(/["'][^"']*login[^"']*["']/gi) || [];
        const authPatterns = js.match(/["'][^"']*auth[^"']*["']/gi) || [];
        const tokenPatterns = js.match(/["'][^"']*token[^"']*["']/gi) || [];
        console.log("Login patterns:", [...new Set(loginPatterns)].slice(0, 10));
        console.log("Auth patterns:", [...new Set(authPatterns)].slice(0, 10));
        console.log("Token patterns:", [...new Set(tokenPatterns)].slice(0, 10));

        // Cari axios/fetch calls
        const apiCalls = js.match(/\.(post|get)\s*\(\s*["'][^"']*["']/gi) || [];
        console.log("API calls:", [...new Set(apiCalls)].slice(0, 15));
    } catch (e) {
        console.log("Gagal fetch JS:", e.message);
    }
}

main();