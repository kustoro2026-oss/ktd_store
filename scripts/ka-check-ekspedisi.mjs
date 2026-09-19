// Cek nilai ekspedisiList dari beberapa produk anekadropship
import * as fs from "node:fs";
import * as path from "node:path";

// Load .env.local
for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\\\$/g, "$").trim();
}

const { anekaClient } = await import("../src/lib/anekadropship.ts");

async function main() {
    await anekaClient.ensureLoggedIn();

    // Ambil sample produk dari berbagai kategori
    const ids = ["9", "10", "11", "12", "18", "100", "200", "500", "1041", "1042", "1046", "1056"];

    const allEkspedisi = new Set();

    for (const id of ids) {
        try {
            const d = await anekaClient.getProductDetail(id);
            if (d?.name) {
                const exp = d.ekspedisiList || [];
                console.log(`[${id}] ${d.name.slice(0, 50)}`);
                console.log(`  Ekspedisi: [${exp.join(", ")}]`);
                exp.forEach(e => allEkspedisi.add(e));
            }
        } catch (e) {
            console.log(`[${id}] ERROR: ${e.message.slice(0, 60)}`);
        }
    }

    console.log("\n=== Semua nilai ekspedisi unik ===");
    [...allEkspedisi].sort().forEach(e => console.log(`  "${e}"`));
}

main().catch(e => { console.error(e); process.exit(1); });