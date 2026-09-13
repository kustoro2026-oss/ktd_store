const BASE = "http://localhost:3000";
async function main() {
    const res = await fetch(BASE + "/produk/2259");
    const html = await res.text();

    // Extract OG tags
    const ogRegex = /<meta\s+property="(og:[^"]+)"\s+content="([^"]*)"/gi;
    let match;
    console.log("=== OG TAGS ===");
    while ((match = ogRegex.exec(html)) !== null) {
        console.log(`  ${match[1]}: ${match[2].substring(0, 100)}`);
    }

    // Extract Twitter tags
    const twRegex = /<meta\s+name="(twitter:[^"]+)"\s+content="([^"]*)"/gi;
    console.log("\n=== TWITTER TAGS ===");
    while ((match = twRegex.exec(html)) !== null) {
        console.log(`  ${match[1]}: ${match[2].substring(0, 100)}`);
    }

    // Check for og:image specifically
    const imgRegex = /<meta\s+property="og:image[^"]*"\s+content="([^"]*)"/gi;
    console.log("\n=== OG IMAGES ===");
    while ((match = imgRegex.exec(html)) !== null) {
        console.log(`  ${match[1]}`);
    }

    // Check response status and time
    console.log(`\nStatus: ${res.status}`);
}
main().catch(e => console.error(e));