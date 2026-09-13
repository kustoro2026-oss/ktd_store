const cheerio = require("cheerio");

async function test() {
    let cookie = "";
    const grab = (res) => {
        const setCookies = res.headers.getSetCookie?.() ?? [];
        for (const c of setCookies) {
            const pair = c.split(";")[0];
            const name = pair.split("=")[0];
            cookie = cookie.replace(new RegExp(name + "=[^;]*;?"), "") + pair + "; ";
        }
    };

    const page = await fetch("https://anekadropship.id/login", { redirect: "manual" });
    grab(page);
    const pageText = await page.text();
    const $ = cheerio.load(pageText);
    const token = $('input[name="_token"]').attr("value") ?? "";

    const res = await fetch("https://anekadropship.id/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
        body: new URLSearchParams({ _token: token, email: "kustoroterbatas@gmail.com", password: "@$Kustores2k24" }),
        redirect: "manual",
    });
    grab(res);
    console.log("Login OK");

    // Test /user/home page 1
    const home = await fetch("https://anekadropship.id/user/home?search=&category=&location=all&seller=all&page=1", {
        headers: { Cookie: cookie },
    });
    const html = await home.text();
    const $2 = cheerio.load(html);

    let count = 0;
    $2('a.line-clamp-2[href*="/products/"]').each((_, el) => { count++; });
    console.log("Produk di halaman 1:", count);

    // Cek total
    const showMatch = html.match(/Menampilkan\s+\d+\s*-\s*\d+\s*dari\s*(\d+)/i);
    console.log("Total text:", showMatch ? showMatch[0] : "not found");

    // Cek page numbers
    const pageNums = [];
    $2('a[href*="page="]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const m = href.match(/page=(\d+)/);
        if (m) pageNums.push(parseInt(m[1]));
    });
    const uniq = [...new Set(pageNums)].sort((a, b) => a - b);
    console.log("Page numbers:", uniq);
    console.log("Max page:", uniq.length > 0 ? Math.max(...uniq) : "unknown");

    // Coba page terakhir
    if (uniq.length > 0) {
        const lastPage = Math.max(...uniq);
        const lastRes = await fetch(`https://anekadropship.id/user/home?search=&category=&location=all&seller=all&page=${lastPage}`, {
            headers: { Cookie: cookie },
        });
        const lastHtml = await lastRes.text();
        const $3 = cheerio.load(lastHtml);
        let lastCount = 0;
        $3('a.line-clamp-2[href*="/products/"]').each((_, el) => { lastCount++; });
        console.log(`Produk di halaman ${lastPage}:`, lastCount);
    }
}

test().catch((e) => console.error(e));