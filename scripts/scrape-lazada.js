/**
 * Lazada Seller Center Product Scraper
 * =====================================
 * Run this script in your browser's DevTools Console while logged into
 * Lazada Seller Center on the product list page:
 *   https://sellercenter.lazada.co.id/apps/product/list?tab=online_product
 *
 * The script will scroll through all pages, collect product names and URLs,
 * and download a JSON file (`lazada-products.json`) when finished.
 *
 * Usage:
 * 1. Login to https://sellercenter.lazada.co.id
 * 2. Go to the product list page (online products tab)
 * 3. Open DevTools (F12) → Console
 * 4. Paste this entire script and press Enter
 * 5. Wait for it to finish — a JSON file will be downloaded automatically
 */

(async function scrapeLazadaProducts() {
    const products = [];
    const seen = new Set();

    // Extract products from the current page
    function extractProducts() {
        // Lazada Seller Center uses a table with product rows
        // Look for table rows that contain product links
        const rows = document.querySelectorAll('table tbody tr');
        for (const row of rows) {
            // Find product name link — typically in a cell with product title
            const links = row.querySelectorAll('a[href*="/product/"]');
            for (const link of links) {
                const name = link.textContent.trim();
                const url = link.href;
                if (!name || !url) continue;
                // Skip non-product links (e.g., category links)
                if (!/\/product\//.test(url)) continue;
                const key = url.split('?')[0];
                if (seen.has(key)) continue;
                seen.add(key);

                // Try to get price and stock from other cells
                const cells = row.querySelectorAll('td');
                let price = '';
                let stock = '';
                for (const cell of cells) {
                    const text = cell.textContent.trim();
                    if (/Rp\s*[\d.,]+/.test(text) && !price) price = text.match(/Rp\s*[\d.,]+/)?.[0] ?? '';
                    if (/^\d+$/.test(text) && !stock) stock = text;
                }

                products.push({
                    name,
                    url,
                    price: price || undefined,
                    stock: stock ? parseInt(stock, 10) : undefined,
                });
            }
        }
    }

    // Click next page button
    function clickNextPage() {
        // Lazada pagination: look for "next" button
        const nextBtn = document.querySelector(
            'button[class*="next"], a[class*="next"], .ant-pagination-next:not(.ant-pagination-disabled), .next:not(.disabled)'
        );
        if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('disabled')) {
            nextBtn.click();
            return true;
        }
        return false;
    }

    // Wait for page to load
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log('🔍 Starting Lazada product scraper...');
    console.log('📄 Page 1...');

    // Scrape first page
    extractProducts();
    console.log(`   Found ${products.length} products so far`);

    // Try to go through pages
    let page = 1;
    const maxPages = 50; // Safety limit
    while (page < maxPages) {
        const hasNext = clickNextPage();
        if (!hasNext) {
            console.log('✅ No more pages. Done!');
            break;
        }
        page++;
        console.log(`📄 Page ${page}...`);
        await wait(2000); // Wait for page to load
        extractProducts();
        console.log(`   Total: ${products.length} products`);
    }

    // Download JSON
    const json = JSON.stringify(products, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lazada-products.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`🎉 Done! Downloaded lazada-products.json with ${products.length} products.`);
    console.log('   Please place this file in the project root directory.');
})();