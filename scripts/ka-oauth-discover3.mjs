// Tes endpoint OAuth KiriminAja — round 3.
// Coba berbagai endpoint di tdev (sandbox) dan client (production) Mitra API.
// Mungkin OAuth menggunakan endpoint berbeda dari yang sudah dicoba.

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
        console.log(text.slice(0, 800));
        return { status: res.status, text };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Round 3: Mencari endpoint auth KiriminAja ===\n");

    const bases = [
        "https://tdev.kiriminaja.com",
        "https://client.kiriminaja.com",
    ];

    for (const BASE of bases) {
        console.log(`\n--- ${BASE} ---`);

        // Coba berbagai path auth
        const paths = [
            "/api/mitra/auth/login",
            "/api/mitra/authenticate",
            "/api/mitra/signin",
            "/api/mitra/user/login",
            "/api/mitra/v2/auth",
            "/api/mitra/v2/login",
            "/api/mitra/v2/token",
            "/api/v1/auth/login",
            "/api/v1/login",
            "/api/auth/token",
            "/api/mitra/get-token",
            "/api/mitra/request-token",
        ];

        for (const path of paths) {
            await tryPost(
                `POST ${path}`,
                `${BASE}${path}`,
                { email: EMAIL, password: PASSWORD }
            );
        }
    }

    // Coba juga dengan username bukan email
    console.log("\n\n--- Coba dengan 'username' key ---");
    await tryPost(
        "POST /api/mitra/auth/login (username)",
        "https://client.kiriminaja.com/api/mitra/auth/login",
        { username: EMAIL, password: PASSWORD }
    );

    // Coba dapatkan token dari dashboard API
    console.log("\n\n--- Coba akses halaman developer/dashboard ---");
    try {
        const res = await fetch("https://developer.kiriminaja.com", {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        const text = await res.text();
        console.log(`HTTP ${res.status}, body length: ${text.length}`);
        // Cari link API docs
        const links = text.match(/href="([^"]*api[^"]*)"/gi) || [];
        console.log("API links found:", links.slice(0, 5));
    } catch (e) {
        console.log("Gagal:", e.message);
    }
}

main();