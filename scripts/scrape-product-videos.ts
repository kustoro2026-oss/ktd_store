/**
 * Scrape product videos from anekadropship marketing kit Google Drive folders.
 *
 * Usage: npx tsx scripts/scrape-product-videos.ts
 * Prerequisites: ANEKA_EMAIL and ANEKA_PASSWORD in .env
 *
 * Output: src/lib/product-videos.ts
 */

import "dotenv/config";
import * as fs from "fs";
import { anekaClient } from "../src/lib/anekadropship";

const MAX_VIDEOS = 3;
const DELAY_MS = 400;
const OUTPUT = "src/lib/product-videos.ts";

/** Extract Google Drive folder ID from a URL. */
function extractFolderId(url: string | null): string | null {
    if (!url) return null;
    const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    const o = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (o) return o[1];
    return null;
}

interface FolderResult {
    files: { id: string; name: string }[];
    folders: string[];
}

/** Fetch embedded folder view to extract file/folder IDs. */
async function listFolder(folderId: string): Promise<FolderResult> {
    const files: { id: string; name: string }[] = [];
    const folders: string[] = [];

    const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
    let html = "";

    // Retry up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            html = await res.text();
            break;
        } catch {
            if (attempt === 1) {
                console.warn(`  ⚠ Folder ${folderId}: failed after 2 attempts`);
                return { files, folders };
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Extract file & folder IDs
    const fileIds = [...new Set((html.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()!))];
    const folderIds = [...new Set((html.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()!))];

    // Get file names (batch with concurrency 3)
    const batchSize = 3;
    for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async (id) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10000);
                try {
                    const fr = await fetch(`https://drive.google.com/file/d/${id}/view`, { signal: controller.signal });
                    const fhtml = await fr.text();
                    const titleMatch = fhtml.match(/<title>(.*?)<\/title>/);
                    return { id, name: titleMatch ? titleMatch[1].replace(" - Google Drive", "").trim() : "" };
                } finally {
                    clearTimeout(timer);
                }
            })
        );
        for (const r of results) {
            if (r.status === "fulfilled") {
                files.push(r.value);
            } else {
                files.push({ id: batch[results.indexOf(r)], name: "" });
            }
        }
    }

    folders.push(...folderIds);
    return { files, folders };
}

/** Recursively find MP4 files in a folder and its subfolders. */
async function findVideos(folderId: string, maxDepth = 2): Promise<{ id: string; name: string }[]> {
    const videos: { id: string; name: string }[] = [];
    const queue = [{ id: folderId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0 && videos.length < MAX_VIDEOS) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const { files, folders } = await listFolder(id);

        for (const f of files) {
            if (videos.length >= MAX_VIDEOS) break;
            if (/\.mp4$/i.test(f.name) || /video/i.test(f.name)) {
                videos.push(f);
            }
        }

        if (depth < maxDepth) {
            for (const fid of folders) {
                if (videos.length >= MAX_VIDEOS) break;
                queue.push({ id: fid, depth: depth + 1 });
            }
        }
    }

    return videos.slice(0, MAX_VIDEOS);
}

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    console.log("🔐 Logging in...");
    await anekaClient.ensureLoggedIn();
    console.log("✅ Logged in\n");

    // Collect product IDs
    console.log("📋 Collecting product IDs...");
    const ids = new Set<string>();

    const collect = async (
        fetcher: (p: number) => Promise<{ products: { id: string }[]; totalPages: number }>,
        label: string
    ) => {
        let page = 1;
        while (true) {
            try {
                const r = await fetcher(page);
                for (const p of r.products) ids.add(p.id);
                console.log(`  ${label} p${page}/${r.totalPages}: +${r.products.length} = ${ids.size} total`);
                if (page >= r.totalPages) break;
                page++;
                await sleep(DELAY_MS);
            } catch (e) {
                console.warn(`  ⚠ ${label} p${page}: ${(e as Error).message}`);
                break;
            }
        }
    };

    await collect((p) => anekaClient.getProducts({ page: p }), "Main");
    await collect((p) => anekaClient.getNewestProducts({ page: p }), "New");
    try { await collect((p) => anekaClient.getMalaysiaProducts({ page: p }), "Msia"); } catch { /* ok */ }

    console.log(`\n📊 Total unique: ${ids.size}\n`);

    // Scrape detail pages
    console.log("🎬 Scraping videos...");
    const results: Record<string, { fileId: string; label: string }[]> = {};
    let done = 0;
    let kits = 0;
    let vids = 0;

    const allIds = [...ids];
    for (let i = 0; i < allIds.length; i++) {
        const id = allIds[i];
        try {
            const detail = await anekaClient.getProductDetail(id);
            done++;
            const folderId = extractFolderId(detail.marketingKitUrl);
            if (!folderId) continue;
            kits++;

            const videos = await findVideos(folderId);
            if (videos.length > 0) {
                vids++;
                results[id] = videos.map((v, idx) => ({
                    fileId: v.id,
                    label: v.name.replace(/\.mp4$/i, "") || `Video ${idx + 1}`,
                }));
            }
        } catch {
            done++;
        }

        if (done % 20 === 0 || i === allIds.length - 1) {
            console.log(`  ${done}/${allIds.length} | kits:${kits} | vids:${vids}`);
        }
        await sleep(300);
    }

    console.log(`\n✅ Done. Products with videos: ${vids}`);

    // Generate output
    const lines = [
        `/**`,
        ` * Product video mapping — auto-generated by scripts/scrape-product-videos.ts`,
        ` * Products scanned: ${allIds.length}, with videos: ${vids}`,
        ` * Generated: ${new Date().toISOString()}`,
        ` */`,
        ``,
        `export type ProductVideo = {`,
        `  fileId: string;`,
        `  label?: string;`,
        `};`,
        ``,
        `const VIDEOS: Record<string, ProductVideo[]> = {`,
    ];

    for (const [pid, videos] of Object.entries(results).sort((a, b) => +a[0] - +b[0])) {
        lines.push(`  "${pid}": [`);
        for (const v of videos) lines.push(`    { fileId: "${v.fileId}", label: "${v.label}" },`);
        lines.push(`  ],`);
    }
    lines.push(`};`);
    lines.push(``);
    lines.push(`export function getProductVideos(productId: string): ProductVideo[] {`);
    lines.push(`  return VIDEOS[productId] ?? [];`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`export function driveEmbedUrl(fileId: string): string {`);
    lines.push(`  return \`https://drive.google.com/file/d/$\{fileId\}/preview\`;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`export function driveStreamUrl(fileId: string): string {`);
    lines.push(`  return \`https://drive.usercontent.google.com/download?id=$\{fileId\}&export=download\`;`);
    lines.push(`}`);

    fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
    console.log(`\n📝 Written to ${OUTPUT}`);
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});