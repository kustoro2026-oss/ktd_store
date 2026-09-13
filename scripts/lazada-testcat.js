// Build a 4-row test file to empirically determine accepted Kategori format
const fs = require('fs');
const XLSX = require('xlsx');

const prox = (u) => 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&output=jpg&w=800&h=800&fit=cover';

const imgSrcs = [
  'https://anekadropship.id/uploads/products/1776655835_69e59ddb16236.png',
  'https://anekadropship.id/uploads/products/1766196157_694603bd20123.jpg',
  'https://anekadropship.id/uploads/products/1780900724_6a2663747f8f3.jpg',
  'https://anekadropship.id/uploads/products/1780900462_6a26626e8b1f4.jpg',
];

// 4 kategori format variants for catId 10003382
const variants = [
  'Pembersih Toilet',                                                                      // A: Indonesian leaf
  'Household Supplies,Cleaning Agents,Bathroom & Toilet,Toilet Cleaners',                  // B: English path from dropdown
  'Bekalan Kelengkapan Rumah,Bahan Pembersih,Kamar Mandi & Toilet,Pembersih Toilet',       // C: Indonesian full path
  '',                                                                                      // D: empty
];

const rows = [];
for (let i = 0; i < 4; i++) {
  const row = [
    String(i + 1),                          // Group No (unique!)
    '10003382',                             // catId
    variants[i],                            // Kategori
    'PRODUK TEST HAPUS SEMENTARA ' + (i + 1),  // Nama
    '',
    prox(imgSrcs[i]), '', '', '', '', '', '', '',
    'No Brand',
    'Produk uji coba untuk validasi format kolom kategori pada bulk upload Lazada. Harap hapus produk ini setelah pengujian.',
    '',
    '', '', '', '', '',
    10, 10, 10,
    0.5,
    10000,
    'KTDTEST-' + (i + 1),
    '',
  ];
  rows.push(row);
}

const wb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const ws = wb.Sheets['template'];
XLSX.utils.sheet_add_aoa(ws, rows, { origin: -1 });
XLSX.writeFile(wb, 'tiktok-upload/lazada-test-kategori.xlsx');
console.log('written lazada-test-kategori.xlsx with 4 test rows');
