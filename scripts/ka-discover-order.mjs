// Discover KiriminAja API endpoints untuk order, waybill, resi, dll.
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
        const preview = text.slice(0, 500);
        console.log(`\n=== ${label} (HTTP ${res.status}) ===`);
        console.log(preview);
        return { status: res.status, text };
    } catch (e) {
        console.log(`\n=== ${label} FAILED ===\n${e.message}`);
        return { status: 0, text: e.message };
    }
}

async function main() {
    console.log("=== Discover KiriminAja Order & Waybill API ===\n");

    // --- Order / Booking ---
    await test("POST /api/mitra/order", "/api/mitra/order", {});
    await test("POST /api/mitra/order/create", "/api/mitra/order/create", {
        origin: 5783, destination: 5783, weight: 1000, courier: "jnt", service: "EZ",
        receiver_name: "Test", receiver_phone: "08123456789", receiver_address: "Jl. Test No.1",
    });
    await test("POST /api/mitra/booking", "/api/mitra/booking", {});
    await test("POST /api/mitra/shipment", "/api/mitra/shipment", {});

    // --- Waybill / Resi / Label ---
    await test("POST /api/mitra/waybill", "/api/mitra/waybill", {});
    await test("POST /api/mitra/waybill/print", "/api/mitra/waybill/print", {});
    await test("POST /api/mitra/print", "/api/mitra/print", {});
    await test("POST /api/mitra/label", "/api/mitra/label", {});
    await test("POST /api/mitra/resi", "/api/mitra/resi", {});

    // --- Tracking ---
    await test("POST /api/mitra/track", "/api/mitra/track", { awb: "TEST123" });

    // --- Pickup ---
    await test("POST /api/mitra/pickup", "/api/mitra/pickup", {});
    await test("POST /api/mitra/pickup/request", "/api/mitra/pickup/request", {});

    // --- List / History ---
    await test("POST /api/mitra/orders", "/api/mitra/orders", {});
    await test("POST /api/mitra/order/history", "/api/mitra/order/history", {});

    // --- v2 ---
    await test("POST /api/mitra/v2/order", "/api/mitra/v2/order", {});
}

main();