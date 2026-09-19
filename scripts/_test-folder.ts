import "dotenv/config";

async function test() {
    // Test folder from product 10 (has videos)
    const folderId = "16CNvlCl30TUg3qjbo1nwIJApnq5FwJQi";

    // Try different pagination params
    const tests = [
        "",
        "&start=0&num=50",
        "&start=0&num=100",
        "&start=8&num=50",
        "?start=0&num=50",
    ];

    for (const params of tests) {
        const url = `https://drive.google.com/embeddedfolderview?id=${folderId}${params}`;
        const res = await fetch(url);
        const html = await res.text();
        const fileCount = (html.match(/\/file\/d\//g) || []).length;
        const folderCount = (html.match(/\/drive\/folders\//g) || []).length;
        console.log(`${params || "(no params)"}: ${fileCount} files, ${folderCount} folders`);
    }
}

test().catch(console.error);