import "dotenv/config";
import { anekaClient } from "../src/lib/anekadropship";

async function test() {
    console.log("Email:", process.env.ANEKA_EMAIL ? "set" : "NOT SET");
    await anekaClient.ensureLoggedIn();
    const d = await anekaClient.getProductDetail("2149");
    console.log("Name:", d.name);
    console.log("marketingKitUrl:", d.marketingKitUrl);
}

test().catch(console.error);