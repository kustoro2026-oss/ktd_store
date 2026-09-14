<?php
/**
 * Proxy KiriminAja — Jembatan API Ongkir
 *
 * Simpan file ini di hosting sebagai: ka-proxy.php
 * Akses dari Vercel: https://charcoal-nesia.com/ka-proxy.php/api/mitra/province
 *
 * Script ini meneruskan request ke KiriminAja.
 * KiriminAja akan melihat IP asli hosting (103.58.102.57),
 * jadi whitelist IP tersebut di dashboard KiriminAja.
 */

// === KONFIGURASI ===
$KA_BASE_URL = 'https://client.kiriminaja.com';
$TIMEOUT = 15; // detik

// === JANGAN DIUBAH ===
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

// Hanya terima POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Ambil path dari URL (setelah ka-proxy.php)
$requestUri = $_SERVER['REQUEST_URI'];
$path = '';

// Parse path setelah nama file script
if (preg_match('#/ka-proxy\.php(/.*)#', $requestUri, $matches)) {
    $path = $matches[1];
} else {
    // Fallback: ambil semua setelah base path
    $basePath = dirname($_SERVER['SCRIPT_NAME']);
    $path = substr($requestUri, strlen($basePath));
}

// Bersihkan path
$path = '/' . ltrim($path, '/');

// Baca body
$body = file_get_contents('php://input');

// Baca auth header
$authHeader = '';
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

// Siapkan curl
$ch = curl_init($KA_BASE_URL . $path);

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => $TIMEOUT,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'Content-Type: application/json',
        'Authorization: ' . $authHeader,
        'Content-Length: ' . strlen($body),
    ],
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Proxy error: ' . $curlError]);
    exit;
}

http_response_code($httpCode);
echo $response;