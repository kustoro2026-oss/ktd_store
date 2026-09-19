import "dotenv/config";
import { anekaClient } from "../src/lib/anekadropship";

async function test() {
    await anekaClient.ensureLoggedIn();
    const d = await anekaClient.getProductDetail("1463");
    console.log("Name:", d.name);
    console.log("marketingKitUrl:", d.marketingKitUrl);

    if (d.marketingKitUrl) {
        const folderMatch = d.marketingKitUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (folderMatch) {
            const folderId = folderMatch[1];
            console.log("Folder ID:", folderId);

            // Check embedded view
            const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
            const res = await fetch(url);
            const html = await res.text();

            const fileIds = [...new Set((html.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()!))];
            const folderIds = [...new Set((html.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()!))];

            console.log(`Files: ${fileIds.length}, Folders: ${folderIds.length}`);

            for (const id of fileIds) {
                const fr = await fetch(`https://drive.google.com/file/d/${id}/view`);
                const fhtml = await fr.text();
                const titleMatch = fhtml.match(/<title>(.*?)<\/title>/);
                const name = titleMatch ? titleMatch[1].replace(" - Google Drive", "").trim() : "?";
                const isVideo = /\.mp4$/i.test(name) || /video/i.test(name);
                console.log(`  ${isVideo ? "🎬" : "📄"} ${id}: ${name}`);
            }

            // Check subfolders
            for (const fid of folderIds) {
                console.log(`\n  Subfolder ${fid}:`);
                const subUrl = `https://drive.google.com/embeddedfolderview?id=${fid}`;
                const subRes = await fetch(subUrl);
                const subHtml = await subRes.text();
                const subFiles = [...new Set((subHtml.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()!))];
                for (const id of subFiles) {
                    const fr = await fetch(`https://drive.google.com/file/d/${id}/view`);
                    const fhtml = await fr.text();
                    const titleMatch = fhtml.match(/<title>(.*?)<\/title>/);
                    const name = titleMatch ? titleMatch[1].replace(" - Google Drive", "").trim() : "?";
                    const isVideo = /\.mp4$/i.test(name) || /video/i.test(name);
                    console.log(`    ${isVideo ? "🎬" : "📄"} ${id}: ${name}`);
                }
            }
        }
    }
}

test().catch(console.error);