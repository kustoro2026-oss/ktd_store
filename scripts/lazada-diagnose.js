/**
 * Lazada Seller Center DOM Diagnostic
 * ====================================
 * Run this in DevTools Console on the product list page to discover
 * the actual DOM structure and find the right selectors.
 *
 * Usage:
 * 1. Login to https://sellercenter.lazada.co.id/apps/product/list?tab=online_product
 * 2. Open DevTools (F12) → Console
 * 3. Paste this entire script and press Enter
 * 4. Copy the output and share it
 */

(function diagnoseLazadaDOM() {
    console.log('=== LAZADA SELLER CENTER DOM DIAGNOSTIC ===\n');

    // 1. Find all tables
    const tables = document.querySelectorAll('table');
    console.log(`1. Tables found: ${tables.length}`);
    tables.forEach((t, i) => {
        console.log(`   Table ${i}: class="${t.className}", rows=${t.querySelectorAll('tr').length}`);
    });

    // 2. Find all links with "product" in href
    const productLinks = document.querySelectorAll('a[href*="product"]');
    console.log(`\n2. Links with "product" in href: ${productLinks.length}`);
    productLinks.forEach((a, i) => {
        if (i < 5) {
            console.log(`   [${i}] href="${a.getAttribute('href')}" text="${a.textContent.trim().slice(0, 80)}"`);
        }
    });
    if (productLinks.length > 5) console.log(`   ... and ${productLinks.length - 5} more`);

    // 3. Find elements with "product" in class name
    const productClassEls = document.querySelectorAll('[class*="product"], [class*="Product"]');
    console.log(`\n3. Elements with "product" in class: ${productClassEls.length}`);
    const classCounts = {};
    productClassEls.forEach(el => {
        const cls = el.className.toString().slice(0, 60);
        classCounts[cls] = (classCounts[cls] || 0) + 1;
    });
    Object.entries(classCounts).slice(0, 10).forEach(([cls, count]) => {
        console.log(`   "${cls}" x${count}`);
    });

    // 4. Find all rows (tr) and show first row structure
    const allRows = document.querySelectorAll('tr');
    console.log(`\n4. Total <tr> rows: ${allRows.length}`);
    if (allRows.length > 0) {
        // Find rows that have links (likely product rows)
        const rowsWithLinks = [...allRows].filter(r => r.querySelector('a'));
        console.log(`   Rows with links: ${rowsWithLinks.length}`);
        if (rowsWithLinks.length > 0) {
            const firstRow = rowsWithLinks[0];
            console.log('   First row with links HTML (first 500 chars):');
            console.log(firstRow.outerHTML.slice(0, 500));
        }
    }

    // 5. Look for common React/Ant Design patterns
    const antTable = document.querySelector('.ant-table, .ant-table-tbody, [class*="table"]');
    console.log(`\n5. Ant Design table container: ${antTable ? 'FOUND' : 'NOT FOUND'}`);
    if (antTable) {
        console.log(`   Tag: ${antTable.tagName}, Class: "${antTable.className}"`);
    }

    // 6. Look for list/card based layouts (not table)
    const listItems = document.querySelectorAll('[class*="list"], [class*="card"], [class*="item"]');
    console.log(`\n6. List/card/item elements: ${listItems.length}`);
    const listClassCounts = {};
    listItems.forEach(el => {
        const cls = el.className.toString().slice(0, 60);
        listClassCounts[cls] = (listClassCounts[cls] || 0) + 1;
    });
    Object.entries(listClassCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([cls, count]) => {
        console.log(`   "${cls}" x${count}`);
    });

    // 7. Dump all unique link href patterns
    const allLinks = document.querySelectorAll('a[href]');
    const hrefPatterns = new Set();
    allLinks.forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.length > 5 && !href.startsWith('#')) {
            // Normalize to pattern
            const pattern = href.replace(/\/\d+/g, '/:id').replace(/\?.*/, '');
            hrefPatterns.add(pattern);
        }
    });
    console.log(`\n7. Unique link href patterns:`);
    [...hrefPatterns].sort().forEach(p => console.log(`   ${p}`));

    // 8. Check for iframe (some SPAs load content in iframes)
    const iframes = document.querySelectorAll('iframe');
    console.log(`\n8. Iframes: ${iframes.length}`);
    iframes.forEach((f, i) => {
        console.log(`   [${i}] src="${f.src.slice(0, 100)}"`);
    });

    // 9. Check for shadow DOM / micro-frontend
    console.log(`\n9. Document title: "${document.title}"`);
    console.log(`   URL: "${location.href}"`);
    console.log(`   ReadyState: ${document.readyState}`);

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    console.log('Copy all output above and share it to fix the scraper.');
})();