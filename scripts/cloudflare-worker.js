/**
 * Cloudflare Worker — Proxy untuk KiriminAja Mitra API.
 *
 * Deploy di: https://odd-snowflake-8ffd.kustoroterbatas.workers.dev
 *
 * Worker ini meneruskan semua request ke KiriminAja.
 * Menggunakan IPv4 langsung (bukan hostname) untuk memaksa koneksi IPv4,
 * karena KiriminAja mungkin tidak mendukung IPv6 dengan baik.
 */

// IP production KiriminAja (client.kiriminaja.com)
// Didapat dari: nslookup client.kiriminaja.com
const KA_HOST = "client.kiriminaja.com";
const KA_ORIGIN = "client.kiriminaja.com";

export default {
    async fetch(request, env, ctx) {
        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
                status: 405,
                headers: { "Content-Type": "application/json" },
            });
        }

        const url = new URL(request.url);
        const targetPath = url.pathname;
        const targetUrl = `https://${KA_HOST}${targetPath}`;

        try {
            const body = await request.text();
            const authHeader = request.headers.get("Authorization") || "";
            const contentType = request.headers.get("Content-Type") || "application/json";

            const kaRes = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": contentType,
                    "Authorization": authHeader,
                    "Host": KA_HOST,
                    "Content-Length": String(new TextEncoder().encode(body).length),
                },
                body,
            });

            const responseBody = await kaRes.text();

            return new Response(responseBody, {
                status: kaRes.status,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                },
            });
        } catch (e) {
            return new Response(
                JSON.stringify({ error: "Proxy error: " + (e.message || "Unknown") }),
                {
                    status: 502,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    },
};