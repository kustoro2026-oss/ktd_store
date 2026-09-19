/**
 * Scrape product videos from anekadropship marketing kit Google Drive folders.
 *
 * How it works:
 * 1. Iterates through all products on anekadropship.id
 * 2. For each product, opens the detail page → extracts the marketing kit link
 * 3. Visits the Google Drive folder → finds .mp4 files (max 3)
 * 4. Also checks "VIDEO PRODUK" subfolder if present
 * 5. Outputs product-videos.ts with the mapping
 *
 * Usage: node scripts/scrape-product-videos.mjs
 *
 * Prerequisites:
 *   ANEKA_EMAIL and ANEKA_PASSWORD env vars must be set
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import the TS module
const { anekaClient } = await import("../src/lib/anekadropship.ts");

const OUTPUT = path.resolve(__dirname, "..", "src", "lib", "product-videos.ts");
const MAX_VIDEOS = 3;
const CONCURRENCY = 3;

/**
 * Extract Google Drive folder ID from a marketing kit URL.
 * Supports formats:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *   https://drive.google.com/drive/u/0/folders/FOLDER_ID
 *   https://drive.google.com/open?id=FOLDER_ID
 *   https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 */
function extractFolderId(url) {
    if (!url) return null;
    // /drive/folders/FOLDER_ID
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    // /open?id=FOLDER_ID
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) return openMatch[1];
    // If the URL is already a /file/d/FILE_ID, it's a single file, not a folder
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return null; // Single file, not a folder
    return null;
}

/**
 * Fetch a Google Drive shared folder page and extract MP4 file IDs.
 * Parses the _DRIVE_STATE JSON embedded in the page.
 */
async function listFolderFiles(folderId) {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    try {
        const res = await fetch(url, { redirect: "follow", timeout: 15000 });
        const html = await res.text();

        const fileIds = new Set();
        const folderIds = [];

        // Method 1: Extract from <script> JSON data
        const driveStateMatch = html.match(/_DRIVE_STATE\s*=\s*(\{.*?\});/s);
        if (driveStateMatch) {
            try {
                const state = JSON.parse(driveStateMatch[1]);
                // Navigate into the file listing structure
                if (state?.[0]) {
                    const entries = state[0];
                    if (Array.isArray(entries)) {
                        for (const entry of entries) {
                            if (Array.isArray(entry) && entry.length >= 3) {
                                const id = entry[0];
                                const name = entry[2];
                                const mime = entry[4] || "";
                                if (typeof id === "string" && typeof name === "string") {
                                    if (name.toLowerCase().endsWith(".mp4") || mime.includes("video")) {
                                        fileIds.add(id);
                                    }
                                    // Check for "VIDEO PRODUK" subfolder
                                    if (mime.includes("folder") && name.toUpperCase().includes("VIDEO")) {
                                        folderIds.push(id);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {
                // JSON parse failed, continue to method 2
            }
        }

        // Method 2: Regex find all /file/d/FILE_ID links in the HTML
        const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/g;
        let fm;
        while ((fm = filePattern.exec(html)) !== null) {
            const fid = fm[1];
            // Check nearby text for .mp4
            const idx = fm.index;
            const context = html.slice(Math.max(0, idx - 200), idx + 200);
            if (context.toLowerCase().includes(".mp4")) {
                fileIds.add(fid);
            }
        }

        return { fileIds: [...fileIds].slice(0, MAX_VIDEOS), folderIds };
    } catch (e) {
        console.warn(`  ⚠ Failed to fetch folder ${folderId}: ${e.message}`);
        return { fileIds: [], folderIds: [] };
    }
}

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function scrape() {
    console.log("🔐 Logging in to anekadropship...");
    await anekaClient.ensureLoggedIn();
    console.log("✅ Logged in.\n");

    // Collect all product IDs by walking paginated listings
    console.log("📋 Collecting product IDs...");
    const allIds = new Set();

    // From main listing
    let page = 1;
    while (true) {
        try {
            const { products, totalPages } = await anekaClient.getProducts({ page });
            for (const p of products) allIds.add(p.id);
            console.log(`  Main listing page ${page}/${totalPages}: ${products.length} products`);
            if (page >= totalPages || page >= 50) break; // Cap at 50 pages
            page++;
            await sleep(400);
        } catch (e) {
            console.warn(`  ⚠ Failed page ${page}: ${e.message}`);
            break;
        }
    }

    // From newest listing
    page = 1;
    while (true) {
        try {
            const { products, totalPages } = await anekaClient.getNewestProducts({ page });
            for (const p of products) allIds.add(p.id);
            console.log(`  Newest page ${page}/${totalPages}: ${products.length} products`);
            if (page >= totalPages || page >= 20) break;
            page++;
            await sleep(400);
        } catch (e) {
            console.warn(`  ⚠ Failed newest page ${page}: ${e.message}`);
            break;
        }
    }

    const ids = [...allIds];
    console.log(`\n📊 Total unique products: ${ids.length}`);

    // Scrape each product detail and extract videos
    console.log("\n🎬 Scraping product details for videos...");
    const results = {};

    let processed = 0;
    let withMarketingKit = 0;
    let withVideos = 0;

    // Process in batches with concurrency
    const batchSize = CONCURRENCY;
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async (id) => {
                try {
                    const detail = await anekaClient.getProductDetail(id);
                    processed++;
                    const folderId = extractFolderId(detail.marketingKitUrl);

                    if (folderId) {
                        withMarketingKit++;
                        const { fileIds, folderIds } = await listFolderFiles(folderId);
                        const allFileIds = [...fileIds];

                        // Check subfolders for "VIDEO PRODUK"
                        for (const subId of folderIds) {
                            if (allFileIds.length >= MAX_VIDEOS) break;
                            const sub = await listFolderFiles(subId);
                            for (const fid of sub.fileIds) {
                                if (!allFileIds.includes(fid)) allFileIds.push(fid);
                            }
                        }

                        if (allFileIds.length > 0) {
                            withVideos++;
                            results[id] = allFileIds.slice(0, MAX_VIDEOS).map((fileId, idx) => ({
                                fileId,
                                label: `Video ${idx + 1}`,
                            }));
                        }
                    }

                    if (processed % 10 === 0) {
                        console.log(`  Progress: ${processed}/${ids.length} | Kits: ${withMarketingKit} | Videos: ${withVideos}`);
                    }
                } catch (e) {
                    processed++;
                    // Skip failed products
                }
                await sleep(300);
            })
        );
        console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${processed}/${ids.length} (${Math.round(processed / ids.length * 100)}%)`);
    }

    console.log(`\n✅ Done. Products with videos: ${withVideos}`);

    // Generate output file
    const lines = [
        "/**",
        " * Product video mapping — auto-generated by scripts/scrape-product-videos.mjs",
        " *",
        ` * Generated: ${new Date().toISOString()}`,
        ` * Products scanned: ${ids.length}`,
        ` * Products with videos: ${withVideos}`,
        " */",
        "",
        'export type ProductVideo = {',
        "  /** Google Drive file ID */",
        "  fileId: string;",
        "  /** Optional label (e.g. \"Video 1\") */",
        "  label?: string;",
        "};",
        "",
        "const VIDEOS: Record<string, ProductVideo[]> = {",
    ];

    for (const [id, videos] of Object.entries(results).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        lines.push(`  "${id}": [`);
        for (const v of videos) {
            lines.push(`    { fileId: "${v.fileId}", label: "${v.label}" },`);
        }
        lines.push(`  ],`);
    }

    lines.push("};");
    lines.push("");
    lines.push("/** Get video list for a product, or empty array if none. */");
    lines.push("export function getProductVideos(productId: string): ProductVideo[] {");
    lines.push("  return VIDEOS[productId] ?? [];");
    lines.push("}");
    lines.push("");
    lines.push("/** Convert Google Drive file ID to iframe embed URL. */");
    lines.push("export function driveEmbedUrl(fileId: string): string {");
    lines.push("  return `https://drive.google.com/file/d/${fileId}/preview`;");
    lines.push("}");
    lines.push("");
    lines.push("/**");
    lines.push(" * Direct stream URL for native <video>.");
    lines.push(" * Uses drive.usercontent.google.com (actual file host).");
    lines.push(" */");
    lines.push("export function driveStreamUrl(fileId: string): string {");
    lines.push("  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;");
    lines.push("}");

    fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
    console.log(`\n📝 Written to ${OUTPUT}`);
    console.log("Done!");
}

scrape().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});