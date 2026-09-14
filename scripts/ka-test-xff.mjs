// Tes: Apakah KiriminAja memeriksa IP socket asli atau X-Forwarded-For?
// Jika XFF tidak berfungsi, proxy dengan IP statis adalah solusi yang tepat.

const API_KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";

async function call(label, url, headers = {}, body = "{}") {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                ...headers,
            },
            body,
        });
        const text = await res.text();
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        console.log(text.slice(0, 400));
        return { status: res.status, text };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Tes: XFF vs IP Asli di KiriminAja Production ===\n");

    // 1. Tanpa XFF (kontrol - harusnya gagal karena IP Vercel/rumah tidak terdaftar)
    await call(
        "PROD tanpa XFF",
        "https://client.kiriminaja.com/api/mitra/province",
        { Authorization: `Bearer ${API_KEY}` }
    );

    // 2. Dengan XFF IP yang terdaftar
    await call(
        "PROD + XFF 54.196.254.27",
        "https://client.kiriminaja.com/api/mitra/province",
        { Authorization: `Bearer ${API_KEY}`, "X-Forwarded-For": "54.196.254.27" }
    );

    // 3. Coba dengan header Forwarded (RFC 7239)
    await call(
        "PROD + Forwarded header",
        "https://client.kiriminaja.com/api/mitra/province",
        { Authorization: `Bearer ${API_KEY}`, "Forwarded": "for=54.196.254.27" }
    );

    // 4. Coba dengan X-Real-IP
    await call(
        "PROD + X-Real-IP",
        "https://client.kiriminaja.com/api/mitra/province",
        { Authorization: `Bearer ${API_KEY}`, "X-Real-IP": "54.196.254.27" }
    );

    // 5. Coba dengan CF-Connecting-IP (Cloudflare style)
    await call(
        "PROD + CF-Connecting-IP",
        "https://client.kiriminaja.com/api/mitra/province",
        { Authorization: `Bearer ${API_KEY}`, "CF-Connecting-IP": "54.196.254.27" }
    );

    // 6. Coba kombinasi semua header
    await call(
        "PROD + ALL IP headers",
        "https://client.kiriminaja.com/api/mitra/province",
        {
            Authorization: `Bearer ${API_KEY}`,
            "X-Forwarded-For": "54.196.254.27",
            "X-Real-IP": "54.196.254.27",
            "Forwarded": "for=54.196.254.27",
            "CF-Connecting-IP": "54.196.254.27",
            "X-Client-IP": "54.196.254.27",
        }
    );

    // 7. Cek IP publik kita saat ini
    try {
        const ip = await fetch("https://api.ipify.org").then(r => r.text());
        console.log(`\nIP publik saat ini: ${ip.trim()}`);
    } catch (e) {
        console.log("Gagal cek IP publik");
    }
}

main();