// Tes endpoint OAuth KiriminAja — cari cara login yang benar.
// KiriminAja CS menyarankan OAuth sebagai alternatif IP whitelist.
// Credentials: kustoroterbatas@gmail.com / @$Kustores2k24

const BASE = "https://client.kiriminaja.com";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";

async function tryLogin(label, url, body, headers = {}) {
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
        console.log(text.slice(0, 600));
        return { status: res.status, text };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Mencari endpoint OAuth KiriminAja ===\n");

    // 1. Coba endpoint OAuth yang umum
    await tryLogin(
        "POST /api/mitra/oauth/token",
        `${BASE}/api/mitra/oauth/token`,
        { email: EMAIL, password: PASSWORD }
    );

    // 2. Coba /api/mitra/login
    await tryLogin(
        "POST /api/mitra/login",
        `${BASE}/api/mitra/login`,
        { email: EMAIL, password: PASSWORD }
    );

    // 3. Coba /api/auth/login
    await tryLogin(
        "POST /api/auth/login",
        `${BASE}/api/auth/login`,
        { email: EMAIL, password: PASSWORD }
    );

    // 4. Coba /api/v1/auth/login
    await tryLogin(
        "POST /api/v1/auth/login",
        `${BASE}/api/v1/auth/login`,
        { email: EMAIL, password: PASSWORD }
    );

    // 5. Coba /api/mitra/auth dengan grant_type password
    await tryLogin(
        "POST /api/mitra/auth (grant_type=password)",
        `${BASE}/api/mitra/auth`,
        { grant_type: "password", email: EMAIL, password: PASSWORD }
    );

    // 6. Coba /oauth/token (Laravel Passport style)
    await tryLogin(
        "POST /oauth/token (Laravel Passport)",
        `${BASE}/oauth/token`,
        { grant_type: "password", client_id: "2", username: EMAIL, password: PASSWORD }
    );

    // 7. Coba /api/mitra/generate-token
    await tryLogin(
        "POST /api/mitra/generate-token",
        `${BASE}/api/mitra/generate-token`,
        { email: EMAIL, password: PASSWORD }
    );

    // 8. Coba /api/login
    await tryLogin(
        "POST /api/login",
        `${BASE}/api/login`,
        { email: EMAIL, password: PASSWORD }
    );

    // 9. Coba dengan form-urlencoded
    await tryLogin(
        "POST /api/mitra/login (form-urlencoded)",
        `${BASE}/api/mitra/login`,
        { email: EMAIL, password: PASSWORD },
        { "Content-Type": "application/x-www-form-urlencoded" }
    );

    // 10. Coba /api/mitra/token
    await tryLogin(
        "POST /api/mitra/token",
        `${BASE}/api/mitra/token`,
        { email: EMAIL, password: PASSWORD }
    );
}

main();