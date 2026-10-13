// Gaya seragam untuk seluruh input teks di website — satu sumber agar semua
// formulir (pencarian, isi saldo, cek status, admin) tampil konsisten dan
// profesional: border netral, hover halus, fokus hanya mengubah border jadi
// brand (satu garis merah, tanpa ring ganda), teks 16px di mobile (mencegah
// zoom iOS).
export const INPUT_CLS =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base text-ink outline-none transition-all placeholder:text-muted-2 hover:border-gray-300 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";
