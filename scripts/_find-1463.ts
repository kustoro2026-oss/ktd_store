import "dotenv/config";
import { anekaClient } from "../src/lib/anekadropship";

async function test() {
    await anekaClient.ensureLoggedIn();

    // Check if 1463 is in the product listings
    let found = false;

    // Check main listing
    for (let page = 1; page <= 50; page++) {
        try {
            const { products, totalPages } = await anekaClient.getProducts({ page });
            for (const p of products) {
                if (p.id === "1463") {
                    console.log(`FOUND in main listing page ${page}: ${p.name}`);
                    found = true;
                }
            }
            if (page >= totalPages) break;
        } catch (e) {
            console.log(`Main page ${page} error: ${(e as Error).message}`);
            break;
        }
    }

    // Check newest listing
    for (let page = 1; page <= 30; page++) {
        try {
            const { products, totalPages } = await anekaClient.getNewestProducts({ page });
            for (const p of products) {
                if (p.id === "1463") {
                    console.log(`FOUND in newest page ${page}: ${p.name}`);
                    found = true;
                }
            }
            if (page >= totalPages) break;
        } catch (e) {
            console.log(`Newest page ${page} error: ${(e as Error).message}`);
            break;
        }
    }

    if (!found) console.log("NOT FOUND in any listing!");
}

test().catch(console.error);