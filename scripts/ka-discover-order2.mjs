// Discover KiriminAja API - coba berbagai pattern path
const PROXY = "https://charcoal-nesia.com/ka-proxy.php";
const KEY = "v4.local.QvOqTtQmlZBjq3ORYtB1aCL94JLZ16_yjqt9CLmfiaqYc0aur2hfod2E8i7_d63yIqjlertDYBMbBr796vc1OOvAnHuoO5hVs2cXpweYF2eSQvvIuB0g6dJAxICUlZte9_-qwK6jCU2HHXiCwC9JAbh4EB92AVI4AD9I";

async function test(label, path, body = {}) {
    try {
        const res = await fetch(`${PROXY}${path}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${KEY}`,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        const short = text.slice(0, 200);
        console.log(`[${res.status}] ${label}: ${short}`);
        return { status: res.status, text };
    } catch (e) {
        console.log(`[ERR] ${label}: ${e.message.slice(0, 80)}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== KiriminAja API Endpoint Discovery v2 ===\n");

    // Versi pattern berbeda
    await test("v1/order", "/api/mitra/v1/order", {});
    await test("v1/order/create", "/api/mitra/v1/order/create", {});
    await test("v6.1/order", "/api/mitra/v6.1/order", {});
    await test("v6.1/waybill", "/api/mitra/v6.1/waybill", {});

    // Tanpa /mitra
    await test("/api/order", "/api/order", {});
    await test("/api/booking", "/api/booking", {});

    // Coba dengan method field di body
    await test("shipping_price dengan method=create_order", "/api/mitra/v6.1/shipping_price", {
        origin: 5783, destination: 5783, weight: 1000,
        method: "create_order", receiver_name: "Test"
    });

    // Coba endpoint yang KEMUNGKINAN ada
    await test("v1/awb", "/api/mitra/v1/awb", {});
    await test("v6.1/awb", "/api/mitra/v6.1/awb", {});
    await test("awb", "/api/mitra/awb", {});

    // Coba generate resi
    await test("generate", "/api/mitra/generate", {});
    await test("v6.1/generate_awb", "/api/mitra/v6.1/generate_awb", {});

    // Informasi akun
    await test("profile", "/api/mitra/profile", {});
    await test("account", "/api/mitra/account", {});
    await test("balance", "/api/mitra/balance", {});
}

main();