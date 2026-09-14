// Tes endpoint OAuth KiriminAja — round 6.
// Fokus ke dashboard.kiriminaja.com dan app.kiriminaja.com

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
        const hdrs = {};
        res.headers.forEach((v, k) => {
            if (["set-cookie", "authorization", "x-auth-token", "content-type"].includes(k)) hdrs[k] = v;
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
    console.log("=== Round 6: Dashboard KiriminAja OAuth ===\n");

    // 1. Akses dashboard login page untuk cari API endpoint
    console.log("1. Mencari API endpoint dari dashboard...");
    try {
        const res = await fetch("https://dashboard.kiriminaja.com/login", {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        const html = await res.text();

        // Cari API URL patterns
        const apiPatterns = [
            ...html.match(/https:\/\/[^"'\s]*api[^"'\s]*/gi) || [],
            ...html.match(/["']\/api\/[^"'\s]*/gi) || [],
            ...html.match(/baseURL[^;]*/gi) || [],
            ...html.match(/API_URL[^;]*/gi) || [],
        ];
        console.log("API patterns found:", [...new Set(apiPatterns)].slice(0, 10));

        // Cari JS entry files
        const jsFiles = html.match(/src="([^"]*\.js[^"]*)"/gi) || [];
        console.log("JS files:", jsFiles.slice(0, 5));
    } catch (e) {
        console.log("Gagal akses dashboard:", e.message);
    }

    // 2. Coba login endpoint di dashboard
    console.log("\n2. Mencoba login endpoint dashboard...");

    const dashboardPaths = [
        "/api/auth/login",
        "/api/login",
        "/api/v1/auth/login",
        "/api/v1/login",
        "/api/auth/signin",
        "/api/mitra/auth/login",
        "/api/mitra/login",
    ];

    for (const path of dashboardPaths) {
        await tryPost(
            `POST dashboard.kiriminaja.com${path}`,
            `https://dashboard.kiriminaja.com${path}`,
            { email: EMAIL, password: PASSWORD }
        );
    }

    // 3. Coba app.kiriminaja.com dengan berbagai path
    console.log("\n3. Mencoba app.kiriminaja.com...");

    const appPaths = [
        "/api/auth/login",
        "/api/login",
        "/api/v1/login",
        "/api/v1/auth/login",
        "/auth/login",
        "/login",
    ];

    for (const path of appPaths) {
        await tryPost(
            `POST app.kiriminaja.com${path}`,
            `https://app.kiriminaja.com${path}`,
            { email: EMAIL, password: PASSWORD }
        );
    }

    // 4. Coba dengan form-urlencoded (Laravel style)
    console.log("\n4. Mencoba dengan form-urlencoded...");

    try {
        const res = await fetch("https://dashboard.kiriminaja.com/api/auth/login", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString(),
        });
        const text = await res.text();
        console.log(`dashboard /api/auth/login (form) -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    } catch (e) {
        console.log("Gagal:", e.message);
    }

    // 5. Coba app.kiriminaja.com dengan form-urlencoded
    try {
        const res = await fetch("https://app.kiriminaja.com/api/auth/login", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString(),
        });
        const text = await res.text();
        console.log(`app /api/auth/login (form) -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    } catch (e) {
        console.log("Gagal:", e.message);
    }
}

main();