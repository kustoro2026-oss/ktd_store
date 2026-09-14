// Tes endpoint OAuth KiriminAja — round 2.
// Coba login via main site kiriminaja.com, bukan client.kiriminaja.com (Mitra API).

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
            redirect: "manual",
        });
        const text = await res.text();
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        // Print response headers that might contain tokens
        const interestingHeaders = ["set-cookie", "authorization", "x-auth-token", "x-csrf-token"];
        for (const h of interestingHeaders) {
            const val = res.headers.get(h);
            if (val) console.log(`  ${h}: ${val.slice(0, 200)}`);
        }
        console.log(text.slice(0, 800));
        return { status: res.status, text, headers: res.headers };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function tryFormLogin(label, url, params, headers = {}) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json, text/html",
                "Content-Type": "application/x-www-form-urlencoded",
                ...headers,
            },
            body: new URLSearchParams(params).toString(),
            redirect: "manual",
        });
        const text = await res.text();
        console.log(`\n== ${label} (HTTP ${res.status}) ==`);
        const interestingHeaders = ["set-cookie", "authorization", "x-auth-token", "location"];
        for (const h of interestingHeaders) {
            const val = res.headers.get(h);
            if (val) console.log(`  ${h}: ${val.slice(0, 200)}`);
        }
        console.log(text.slice(0, 800));
        return { status: res.status, text, headers: res.headers };
    } catch (e) {
        console.log(`\n== ${label} FAILED ==\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Mencari endpoint OAuth KiriminAja (Round 2 - Main Site) ===\n");

    // 1. Main site login API
    await tryLogin(
        "POST https://kiriminaja.com/api/login",
        "https://kiriminaja.com/api/login",
        { email: EMAIL, password: PASSWORD }
    );

    // 2. Main site login form
    await tryFormLogin(
        "POST https://kiriminaja.com/login (form)",
        "https://kiriminaja.com/login",
        { email: EMAIL, password: PASSWORD, _token: "" }
    );

    // 3. Try with X-Requested-With: XMLHttpRequest (Laravel AJAX detection)
    await tryLogin(
        "POST https://kiriminaja.com/api/login (X-Requested-With)",
        "https://kiriminaja.com/api/login",
        { email: EMAIL, password: PASSWORD },
        { "X-Requested-With": "XMLHttpRequest" }
    );

    // 4. Try api.kiriminaja.com
    await tryLogin(
        "POST https://api.kiriminaja.com/api/login",
        "https://api.kiriminaja.com/api/login",
        { email: EMAIL, password: PASSWORD }
    );

    // 5. Try developer.kiriminaja.com
    await tryLogin(
        "POST https://developer.kiriminaja.com/api/login",
        "https://developer.kiriminaja.com/api/login",
        { email: EMAIL, password: PASSWORD }
    );

    // 6. Try sandbox login
    await tryLogin(
        "POST https://tdev.kiriminaja.com/api/login",
        "https://tdev.kiriminaja.com/api/login",
        { email: EMAIL, password: PASSWORD }
    );

    // 7. Try KiriminAja dashboard login (get CSRF first, then login)
    console.log("\n=== Mencoba login via dashboard kiriminaja.com ===");
    try {
        // Get CSRF token from login page
        const pageRes = await fetch("https://kiriminaja.com/login", {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        const pageHtml = await pageRes.text();
        const csrfMatch = pageHtml.match(/name="_token"\s+value="([^"]*)"/);
        const csrfToken = csrfMatch ? csrfMatch[1] : "";
        console.log(`CSRF token: ${csrfToken ? csrfToken.slice(0, 20) + "..." : "NOT FOUND"}`);

        // Get cookies
        const cookies = pageRes.headers.get("set-cookie") || "";
        console.log(`Cookies: ${cookies.slice(0, 200)}`);

        if (csrfToken) {
            await tryFormLogin(
                "POST https://kiriminaja.com/login (with CSRF + cookies)",
                "https://kiriminaja.com/login",
                { _token: csrfToken, email: EMAIL, password: PASSWORD },
                { Cookie: cookies }
            );
        }
    } catch (e) {
        console.log(`Gagal dapat CSRF: ${e.message}`);
    }
}

main();