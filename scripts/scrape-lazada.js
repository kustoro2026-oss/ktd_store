/**
 * Lazada Seller Center Product Scraper (v4)
 * =========================================
 * Run this script in your browser's DevTools Console while logged into
 * Lazada Seller Center on the product list page:
 *   https://sellercenter.lazada.co.id/apps/product/list?tab=online_product
 *
 * Strategy: Set pageSize to a large number to load all products in one page,
 * then scrape everything at once.
 *
 * Usage:
 * 1. Login to https://sellercenter.lazada.co.id
 * 2. Go to: https://sellercenter.lazada.co.id/apps/product/list?tab=online_product&pageSize=200&current=1
 * 3. Open DevTools (F12) → Console
 * 4. Paste this entire script and press Enter
 * 5. A JSON file will be downloaded automatically
 */

(async function scrapeLazadaProducts() {
    const products = [];
    const seen = new Set();

    console.log('🔍 Lazada Product Scraper v4');
    console.log('   Looking for .product-item-wrap elements...\n');

    // Find all product items
    const items = document.querySelectorAll('.product-item-wrap');
    console.log(`   Found ${items.length} product items in DOM`);

    for (const item of items) {
        // Find the product link (goes to lazada.co.id)
        const link = item.querySelector('a[href*="lazada.co.id"]');
        if (!link) continue;

        const url = link.href;
        const key = url.split('?')[0];
        if (seen.has(key)) continue;
        seen.add(key);

        // Get the full text content of the item
        const fullText = item.textContent.trim();

        // Extract price (IDR format: "IDR 49000.00 - 49000.00" or "IDR 49000.00")
        let price = '';
        const priceMatch = fullText.match(/IDR\s*[\d.,]+\s*-\s*[\d.,]+/);
        if (priceMatch) {
            price = priceMatch[0];
        } else {
            const singlePriceMatch = fullText.match(/IDR\s*[\d.,]+/);
            if (singlePriceMatch) price = singlePriceMatch[0];
        }

        // Extract stock ("Stok: 94")
        let stock = '';
        const stockMatch = fullText.match(/Stok\s*:?\s*(\d+)/i);
        if (stockMatch) stock = parseInt(stockMatch[1], 10);

        // Extract name by removing the price+stock suffix
        // Pattern: "Product NameIDR XXXXX.XX - XXXXX.XXStok: XX"
        let name = fullText
            .replace(/\s*IDR\s*[\d.,]+(\s*-\s*[\d.,]+)?\s*Stok\s*:?\s*\d+\s*$/, '')
            .trim();

        // Fallback: if name still contains IDR/Stok, try splitting on IDR
        if (!name || /IDR|Stok/i.test(name)) {
            const parts = fullText.split(/IDR/i);
            name = parts[0].trim();
        }

        // Fallback: use link text
        if (!name || name.length < 3) {
            name = link.textContent.trim();
        }

        // Clean up name (remove excessive whitespace)
        name = name.replace(/\s+/g, ' ').trim();

        products.push({
            name: name || '(unknown)',
            url,
            price: price || undefined,
            stock: stock || undefined,
        });
    }

    console.log(`   Extracted ${products.length} unique products\n`);

    if (products.length === 0) {
        console.log('❌ No products found!');
        console.log('   Try increasing pageSize in the URL to 200 or 500.');
        console.log('   Current URL:', location.href);
        console.log('\n   Debug: first 3 .product-item-wrap HTML:');
        items.forEach((item, i) => {
            if (i < 3) console.log(`   [${i}]:`, item.outerHTML.slice(0, 300));
        });
        return;
    }

    // Show sample
    console.log('📋 Sample products:');
    products.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}`);
        console.log(`      ${p.url}`);
        if (p.price) console.log(`      ${p.price}`);
        if (p.stock) console.log(`      Stok: ${p.stock}`);
    });
    if (products.length > 5) console.log(`   ... and ${products.length - 5} more`);

    // Download JSON
    const json = JSON.stringify(products, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'lazada-products.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    console.log(`\n🎉 Done! Downloaded lazada-products.json with ${products.length} products.`);
    console.log('   Place this file in the project root directory.');
})();