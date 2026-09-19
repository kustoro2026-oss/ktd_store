import "dotenv/config";

async function checkFolder(folderId: string, label: string) {
    const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
    const res = await fetch(url);
    const html = await res.text();
    const ids = [...new Set((html.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()))];
    const subFolders = [...new Set((html.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/g) || []).map(m => m.split("/").pop()))];

    console.log(`\n${label} (${folderId}):`);
    console.log(`  Files: ${ids.length}, Subfolders: ${subFolders.length}`);

    for (const id of ids) {
        try {
            const fr = await fetch(`https://drive.google.com/file/d/${id}/view`);
            const fhtml = await fr.text();
            const titleMatch = fhtml.match(/<title>(.*?)<\/title>/);
            const title = titleMatch ? titleMatch[1].replace(" - Google Drive", "") : "?";
            const isVideo = title.toLowerCase().endsWith(".mp4") || title.toLowerCase().includes("video");
            console.log(`  ${isVideo ? "🎬" : "📄"} ${id}: ${title}`);
        } catch (e) {
            console.log(`  ❌ ${id}: ERROR`);
        }
    }

    return { ids, subFolders };
}

async function test() {
    const mainFolder = "16CNvlCl30TUg3qjbo1nwIJApnq5FwJQi";

    // Check main folder
    const main = await checkFolder(mainFolder, "MAIN");

    // Check subfolders
    for (const subId of main.subFolders) {
        const sub = await checkFolder(subId, "SUBFOLDER");
        // Check sub-subfolders
        for (const subSubId of sub.subFolders) {
            await checkFolder(subSubId, "SUB-SUBFOLDER");
        }
    }
}

test().catch(console.error);