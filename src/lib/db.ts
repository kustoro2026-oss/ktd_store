// Database pesanan top-up — dua backend dengan API async yang sama:
//
// - Produksi (Vercel): Postgres via driver serverless Neon. Filesystem
//   serverless Vercel bersifat sementara, jadi SQLite tidak bisa dipakai di
//   sana. Koneksi diambil dari env DATABASE_URL (atau POSTGRES_URL bawaan
//   Vercel Postgres) — hubungkan database lewat dashboard Vercel → Storage.
// - Pengembangan lokal: SQLite via node:sqlite (file data/topup.db,
//   folder ini di-gitignore).
//
// Semua fungsi bersifat async dan selalu mengembalikan objek biasa — React
// menolak meneruskan baris berprototipe null dari node:sqlite ke Client
// Component, jadi baris disalin dulu.
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Pool } from "@neondatabase/serverless";
import { normalizePhone } from "./wa";

export type PaymentStatus = "pending" | "paid" | "expired" | "failed";

export type TopupStatus =
  | "waiting_payment"
  | "processing"
  | "success"
  | "pending"
  | "failed";

export type TopUpOrder = {
  /** ID pesanan tampilan, mis. KTD-M2XQ9K. */
  id: string;
  /** Referensi unik — dipakai sebagai merchantOrderId Duitku DAN ref_id
   *  Digiflazz. */
  ref_id: string;
  sku: string;
  product_name: string;
  customer_no: string;
  /** Harga jual ke pembeli (Rp). */
  amount: number;
  /** Harga beli Digiflazz (Rp). */
  cost: number;
  buyer_name: string;
  buyer_phone: string;
  /** Catatan verifikasi CS (mis. Nickname game) — tidak dikirim ke Digiflazz. */
  note: string;
  payment_status: PaymentStatus;
  topup_status: TopupStatus;
  /** Referensi transaksi dari payment gateway (Duitku reference). */
  gateway_session: string;
  /** ID transaksi dari payment gateway (Duitku publisherOrderId/reference). */
  gateway_trx: string;
  payment_url: string;
  /** Nomor VA (bila metode VA) — ditampilkan tanpa redirect. */
  payment_va: string;
  /** String QRIS (bila metode QRIS) — dirender jadi QR di sisi kita. */
  payment_qr: string;
  paid_at: string;
  digiflazz_sn: string;
  error_message: string;
  /** Jumlah percobaan eksekusi Digiflazz (Lapis 1 retry). */
  exec_attempts: number;
  /** Ref Digiflazz tiap percobaan, dipisah koma diapit (",ref,") — dipakai
   *  mencocokkan webhook percobaan ke-2/3. */
  attempt_refs: string;
  created_at: string;
  updated_at: string;
};

const g = globalThis as unknown as {
  __ktdTopupPg?: Pool;
  __ktdTopupSqlite?: DatabaseSync;
};

// ---------- inti koneksi ----------

export function dbMode(): "pg" | "sqlite" {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL
    ? "pg"
    : "sqlite";
}

function pgUrl(): string {
  return (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
}

// node:sqlite memakai placeholder `?`; Postgres memakai $1, $2, ... — tulis
// query sekali dengan `?` lalu terjemahkan untuk Postgres.
function toPg(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

/** Pecah blok SQL multi-statement menjadi daftar statement tunggal. */
function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function pgPool(): Promise<Pool> {
  if (!g.__ktdTopupPg) {
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: pgUrl() });
    // Driver serverless Neon tidak dijamin mendukung query multi-statement —
    // jalankan tiap statement satu per satu. Kegagalan init tidak boleh
    // mengunci seluruh lapisan DB (tabel lama tetap bisa dipakai).
    for (const stmt of splitStatements(SCHEMA_SQL + "\n" + STORE_SCHEMA_SQL)) {
      try {
        await pool.query(stmt);
      } catch (e) {
        console.error(
          "[db] init schema gagal:",
          e instanceof Error ? e.message : e,
        );
      }
    }
    // Tabel PG lama dibuat tanpa kolom payment_va/payment_qr — tambahkan
    // idempoten (ADD COLUMN IF NOT EXISTS).
    for (const alter of [
      "ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS payment_va TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS payment_qr TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS exec_attempts INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS attempt_refs TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_va TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_qr TEXT NOT NULL DEFAULT ''",
    ]) {
      try {
        await pool.query(alter);
      } catch (e) {
        console.error("[db] alter gagal:", e instanceof Error ? e.message : e);
      }
    }
    g.__ktdTopupPg = pool;
  }
  return g.__ktdTopupPg;
}

async function sqliteDb(): Promise<DatabaseSync> {
  if (!g.__ktdTopupSqlite) {
    if (process.env.VERCEL) {
      throw new Error(
        "Pesanan top-up di Vercel butuh DATABASE_URL (Postgres/Neon) — hubungkan database di dashboard Vercel → Storage, lalu redeploy.",
      );
    }
    const { DatabaseSync: Db } = await import("node:sqlite");
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new Db(path.join(dir, "topup.db"));
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(SCHEMA_SQL);
    db.exec(STORE_SCHEMA_SQL);
    migrateSqliteColumns(db);
    g.__ktdTopupSqlite = db;
  }
  return g.__ktdTopupSqlite;
}

type Row = Record<string, unknown>;

/** Migrasi SQLite file lama: tambah kolom gateway_* bila belum ada
 *  (tabel lokal dibuat sebelum kolom diganti nama dari ipaymu_*). Kolom
 *  lama dibiarkan — data sesi iPaymu tidak relevan untuk Duitku. */
function migrateSqliteColumns(db: DatabaseSync): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info(topup_orders)").all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  if (!cols.has("gateway_session")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN gateway_session TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("gateway_trx")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN gateway_trx TEXT NOT NULL DEFAULT ''");
  }
  const storeCols = new Set(
    (
      db.prepare("PRAGMA table_info(store_orders)").all() as { name: string }[]
    ).map((c) => c.name),
  );
  if (!storeCols.has("note")) {
    db.exec("ALTER TABLE store_orders ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  }
  if (!storeCols.has("payment_va")) {
    db.exec("ALTER TABLE store_orders ADD COLUMN payment_va TEXT NOT NULL DEFAULT ''");
  }
  if (!storeCols.has("payment_qr")) {
    db.exec("ALTER TABLE store_orders ADD COLUMN payment_qr TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("payment_va")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN payment_va TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("payment_qr")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN payment_qr TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("note")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("exec_attempts")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN exec_attempts INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("attempt_refs")) {
    db.exec("ALTER TABLE topup_orders ADD COLUMN attempt_refs TEXT NOT NULL DEFAULT ''");
  }
}

// Postgres mengembalikan kolom timestamptz sebagai objek Date — ubah ke
// string "YYYY-MM-DD HH:MM:SS" (UTC) supaya tampilan seragam dengan SQLite.
// Kolom pesanan top-up disimpan sebagai TEXT sehingga praktis tidak kena,
// tapi penjaga ini tetap dipasang untuk keamanan.
function normalizePgRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] =
      v instanceof Date ? v.toISOString().slice(0, 19).replace("T", " ") : v;
  }
  return out;
}

async function queryAll<T>(
  sql: string,
  params: SQLInputValue[] = [],
): Promise<T[]> {
  if (dbMode() === "pg") {
    const { rows } = await (await pgPool()).query(toPg(sql), params);
    return rows.map(normalizePgRow) as unknown as T[];
  }
  const rows = (await sqliteDb()).prepare(sql).all(...params) as unknown[];
  return plainRows<T>(rows);
}

async function queryOne<T>(
  sql: string,
  params: SQLInputValue[] = [],
): Promise<T | undefined> {
  if (dbMode() === "pg") {
    const { rows } = await (await pgPool()).query(toPg(sql), params);
    return rows.length ? (normalizePgRow(rows[0]) as unknown as T) : undefined;
  }
  const row = (await sqliteDb()).prepare(sql).get(...params);
  return row ? ({ ...(row as object) } as T) : undefined;
}

async function queryRun(
  sql: string,
  params: SQLInputValue[] = [],
): Promise<void> {
  if (dbMode() === "pg") {
    await (await pgPool()).query(toPg(sql), params);
    return;
  }
  (await sqliteDb()).prepare(sql).run(...params);
}

// Baris dari node:sqlite berprototipe null — salin ke objek biasa sebelum
// dikembalikan.
function plainRows<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as Record<string, unknown>) })) as T[];
}

// ---------- migrasi ----------
//
// Skema ditulis sekali dan kompatibel di kedua backend (TEXT PRIMARY KEY,
// tanpa AUTOINCREMENT / tipe khusus mesin). created_at & updated_at selalu
// diisi dari aplikasi sebagai teks UTC "YYYY-MM-DD HH:MM:SS" sehingga
// perbandingan string aman di keduanya.

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS topup_orders (
    id TEXT PRIMARY KEY,
    ref_id TEXT NOT NULL UNIQUE,
    sku TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    customer_no TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL DEFAULT 0,
    cost INTEGER NOT NULL DEFAULT 0,
    buyer_name TEXT NOT NULL DEFAULT '',
    buyer_phone TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    topup_status TEXT NOT NULL DEFAULT 'waiting_payment',
    gateway_session TEXT NOT NULL DEFAULT '',
    gateway_trx TEXT NOT NULL DEFAULT '',
    payment_url TEXT NOT NULL DEFAULT '',
    payment_va TEXT NOT NULL DEFAULT '',
    payment_qr TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT '',
    digiflazz_sn TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    exec_attempts INTEGER NOT NULL DEFAULT 0,
    attempt_refs TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_topup_orders_created
    ON topup_orders (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_topup_orders_pending
    ON topup_orders (payment_status, topup_status);

  CREATE TABLE IF NOT EXISTS topup_webhook_log (
    id TEXT PRIMARY KEY,
    ref_id TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_topup_webhook_log_created
    ON topup_webhook_log (created_at DESC);

  -- Snapshot kesehatan produk (pintu pra-bayar): hanya SKU yang sedang
  -- Gangguan di Digiflazz — absen dari tabel berarti dianggap sehat.
  CREATE TABLE IF NOT EXISTS topup_health_snapshot (
    sku TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT '',
    seller TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
`;

/** Waktu sekarang sebagai teks UTC "YYYY-MM-DD HH:MM:SS" (format sama di
 *  SQLite & Postgres — aman untuk perbandingan string di kedua backend). */
export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// ---------- ID pesanan ----------

/** ID tampilan pendek, mis. KTD-M2XQ9K. */
export function newOrderId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `KTD-${t}${r}`;
}

/** Ref unik internal — dipakai sebagai merchantOrderId Duitku sekaligus
 *  ref_id Digiflazz (tanpa strip supaya aman di kedua sistem). */
export function newRefId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KTD${t}${r}`;
}

// ---------- pesanan top-up ----------

export async function createTopupOrder(o: {
  id: string;
  ref_id: string;
  sku: string;
  product_name: string;
  customer_no: string;
  amount: number;
  cost: number;
  buyer_name: string;
  buyer_phone: string;
  note?: string;
}): Promise<TopUpOrder> {
  const now = nowUtc();
  const row = await queryOne<TopUpOrder>(
    `INSERT INTO topup_orders
       (id, ref_id, sku, product_name, customer_no, amount, cost,
        buyer_name, buyer_phone, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      o.id,
      o.ref_id,
      o.sku,
      o.product_name,
      o.customer_no,
      o.amount,
      o.cost,
      o.buyer_name,
      o.buyer_phone,
      o.note ?? "",
      now,
      now,
    ],
  );
  if (!row) throw new Error("gagal menyimpan pesanan");
  return row;
}

export async function getTopupOrder(
  id: string,
): Promise<TopUpOrder | undefined> {
  return queryOne<TopUpOrder>("SELECT * FROM topup_orders WHERE id = ?", [id]);
}

export async function getTopupOrderByRef(
  refId: string,
): Promise<TopUpOrder | undefined> {
  const direct = await queryOne<TopUpOrder>(
    "SELECT * FROM topup_orders WHERE ref_id = ?",
    [refId],
  );
  if (direct) return direct;
  // Ref percobaan ulang (Lapis 1) disimpan di kolom attempt_refs (bentuk
  // ",ref,ref2,") — webhook telat untuk percobaan ke-2/3 tetap menemukan
  // pesanannya via pencocokan token persis.
  const viaAttempt = await queryOne<TopUpOrder>(
    "SELECT * FROM topup_orders WHERE attempt_refs LIKE ?",
    [`%,${refId},%`],
  );
  if (viaAttempt) return viaAttempt;
  // Cadangan terakhir: ref percobaan berpola "<ref_id>-N" — kembalikan ke
  // ref dasar bila dua lapis di atas belum cocok.
  const m = /^(.+)-\d+$/.exec(refId);
  if (!m) return undefined;
  return queryOne<TopUpOrder>("SELECT * FROM topup_orders WHERE ref_id = ?", [
    m[1],
  ]);
}

/** Simpan data sesi payment gateway hasil buat pembayaran. */
export async function setOrderPaymentSession(
  id: string,
  sessionId: string,
  paymentUrl: string,
  vaNumber = "",
  qrString = "",
): Promise<void> {
  await queryRun(
    `UPDATE topup_orders
     SET gateway_session = ?, payment_url = ?, payment_va = ?, payment_qr = ?,
         updated_at = ?
     WHERE id = ?`,
    [sessionId, paymentUrl, vaNumber, qrString, nowUtc(), id],
  );
}

/** Tandai pembayaran lunas (webhook terverifikasi / cek transaksi gateway).
 *  Idempoten: tidak menimpa paid_at yang sudah ada. */
export async function markOrderPaid(
  id: string,
  trxId = "",
  paidAt = nowUtc(),
): Promise<void> {
  await queryRun(
    `UPDATE topup_orders
     SET payment_status = 'paid', gateway_trx = ?,
         paid_at = CASE WHEN paid_at = '' THEN ? ELSE paid_at END,
         error_message = '', updated_at = ?
     WHERE id = ? AND payment_status != 'paid'`,
    [trxId, paidAt, nowUtc(), id],
  );
}

/** Tandai pembayaran kedaluwarsa / gagal (webhook "expired"). */
export async function markOrderPaymentEnded(
  id: string,
  status: "expired" | "failed",
  message = "",
): Promise<void> {
  await queryRun(
    "UPDATE topup_orders SET payment_status = ?, error_message = ?, updated_at = ? WHERE id = ? AND payment_status = 'pending'",
    [status, message, nowUtc(), id],
  );
}

/** Klaim atomik eksekusi top-up — hanya pesanan lunas yang masih menunggu
 *  boleh dieksekusi. Mengembalikan baris pesanan bila berhasil diklaim
 *  (mencegah webhook retry / cron / admin mengeksekusi dua kali). */
export async function claimTopupExecution(
  id: string,
): Promise<TopUpOrder | undefined> {
  return queryOne<TopUpOrder>(
    `UPDATE topup_orders
     SET topup_status = 'processing', updated_at = ?
     WHERE id = ? AND payment_status = 'paid' AND topup_status = 'waiting_payment'
     RETURNING *`,
    [nowUtc(), id],
  );
}

/** Catat satu percobaan eksekusi Digiflazz (Lapis 1 retry) beserta ref-nya
 *  — ref percobaan ke-2/3 dipakai mencocokkan webhook telat. */
export async function recordExecAttempt(
  id: string,
  refId: string,
): Promise<void> {
  const order = await getTopupOrder(id);
  const token = `,${refId},`;
  const prev = order?.attempt_refs ?? "";
  const base = prev.startsWith(",") ? prev : `,${prev}`;
  const next = base.includes(token) ? base : `${base}${refId},`;
  await queryRun(
    "UPDATE topup_orders SET exec_attempts = exec_attempts + 1, attempt_refs = ?, updated_at = ? WHERE id = ?",
    [next, nowUtc(), id],
  );
}

// ---------- snapshot kesehatan produk (pintu pra-bayar) ----------

export type HealthSnapshotRow = {
  sku: string;
  status: string;
  seller: string;
  updated_at: string;
};

/** Baris gangguan untuk satu SKU — kosong berarti sehat (fail-open). */
export async function getHealthSnapshot(
  sku: string,
): Promise<HealthSnapshotRow | undefined> {
  return queryOne<HealthSnapshotRow>(
    "SELECT sku, status, seller, updated_at FROM topup_health_snapshot WHERE sku = ?",
    [sku],
  );
}

/** Seluruh baris snapshot gangguan (untuk konsol admin / verifikasi). */
export async function listHealthSnapshot(): Promise<HealthSnapshotRow[]> {
  return queryAll<HealthSnapshotRow>(
    "SELECT sku, status, seller, updated_at FROM topup_health_snapshot ORDER BY updated_at DESC",
  );
}

/** Ganti isi snapshot dengan daftar gangguan terkini: baris yang sudah
 *  pulih dihapus, baris baru di-upsert (ON CONFLICT — didukung kedua
 *  backend). */
export async function replaceHealthSnapshot(
  gangguan: { sku: string; status: string; seller: string }[],
): Promise<void> {
  const now = nowUtc();
  const fresh = new Set(gangguan.map((g) => g.sku));
  const existing = await listHealthSnapshot();
  for (const row of existing) {
    if (!fresh.has(row.sku)) {
      await queryRun("DELETE FROM topup_health_snapshot WHERE sku = ?", [row.sku]);
    }
  }
  for (const g of gangguan) {
    await queryRun(
      `INSERT INTO topup_health_snapshot (sku, status, seller, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (sku) DO UPDATE
         SET status = excluded.status, seller = excluded.seller, updated_at = excluded.updated_at`,
      [g.sku, g.status, g.seller, now],
    );
  }
}

/** Catat hasil eksekusi Digiflazz: sukses / pending / failed. */
export async function finishTopup(
  id: string,
  topupStatus: "success" | "pending" | "failed",
  sn = "",
  errorMessage = "",
): Promise<void> {
  await queryRun(
    "UPDATE topup_orders SET topup_status = ?, digiflazz_sn = ?, error_message = ?, updated_at = ? WHERE id = ?",
    [topupStatus, sn, errorMessage, nowUtc(), id],
  );
}

// ---------- log webhook Digiflazz ----------

/** Simpan jejak setiap POST webhook Digiflazz (payload mentah + hasil
 *  prosesnya) untuk audit — dipakai route /api/topup/webhook dan konsol. */
export async function logTopupWebhook(o: {
  refId: string;
  payload: string;
  action: string;
}): Promise<void> {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  const id = `WH-${t}${r}`;
  await queryRun(
    "INSERT INTO topup_webhook_log (id, ref_id, payload, action, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, o.refId, o.payload.slice(0, 8000), o.action, nowUtc()],
  );
}

/** Log webhook terbaru (payload dipangkas di penyimpanan, bukan di sini). */
export async function listTopupWebhookLogs(limit = 20): Promise<
  { id: string; ref_id: string; payload: string; action: string; created_at: string }[]
> {
  return queryAll(
    "SELECT id, ref_id, payload, action, created_at FROM topup_webhook_log ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}

/** Daftar pesanan terbaru untuk panel admin. */
export async function listTopupOrders(limit = 10): Promise<TopUpOrder[]> {
  return queryAll<TopUpOrder>(
    "SELECT * FROM topup_orders ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}

/** Riwayat pesanan seorang pembeli — cocokkan nomor HP ternormalisasi
 *  (62xxxxxxxx). buyer_phone disimpan apa adanya, jadi pencocokan dilakukan
 *  di JS dari baris terbaru yang mengisi nomor HP. */
export async function listTopupOrdersByPhone(
  phone: string,
  limit = 20,
): Promise<TopUpOrder[]> {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const recent = await queryAll<TopUpOrder>(
    "SELECT * FROM topup_orders WHERE buyer_phone != '' ORDER BY created_at DESC LIMIT 500",
  );
  return recent
    .filter((o) => normalizePhone(o.buyer_phone) === normalized)
    .slice(0, limit);
}

/** Pesanan lunas yang transaksinya masih Pending di Digiflazz — dicek ulang
 *  oleh cron/klik admin (kirim ulang ref_id sama = idempoten). */
export async function listPendingTopups(): Promise<TopUpOrder[]> {
  return queryAll<TopUpOrder>(
    `SELECT * FROM topup_orders
     WHERE payment_status = 'paid' AND topup_status IN ('processing', 'pending')
     ORDER BY updated_at ASC LIMIT 20`,
  );
}

/** Pesanan gateway yang tak kunjung dibayar → expired (hanya yang punya
 *  sesi gateway; pesanan fallback WA tanpa sesi tetap pending untuk CS). */
export async function expireStalePendingOrders(
  olderThanHours = 26,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const claimed = await queryAll<{ id: string }>(
    `UPDATE topup_orders
     SET payment_status = 'expired', topup_status = 'failed',
         error_message = 'Pembayaran kedaluwarsa', updated_at = ?
     WHERE payment_status = 'pending' AND gateway_session != '' AND created_at <= ?
     RETURNING id`,
    [nowUtc(), cutoff],
  );
  return claimed.length;
}

// ============================================================================
// Pesanan checkout toko (produk fisik — modal Checkout Pesanan) dengan
// pembayaran Duitku. Tabel terpisah dari topup_orders: isi kolomnya beda
// (alamat kirim, item keranjang, ongkir). Dibaca webhook Duitku untuk
// menandai lunas + notifikasi otomatis ke WA bot.
// ============================================================================

/** Item pesanan tersimpan sebagai JSON di kolom items. */
export type StoreOrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

export type StoreOrder = {
  id: string;
  /** ref_id = merchantOrderId Duitku. */
  ref_id: string;
  /** JSON StoreOrderItem[]. */
  items: string;
  buyer_name: string;
  buyer_phone: string;
  address: string;
  /** Catatan pembeli (warna/ukuran, dll) — ikut di pesan WA pemilik. */
  note: string;
  /** Label kecamatan/kota/provinsi untuk pesan WA. */
  district_label: string;
  /** Ringkasan kurir + ongkir untuk pesan WA. */
  shipping_label: string;
  subtotal: number;
  shipping_cost: number;
  cod_fee: number;
  total: number;
  payment_method: string;
  payment_status: "pending" | "paid" | "expired" | "failed";
  gateway_session: string;
  gateway_trx: string;
  payment_url: string;
  /** Nomor VA (bila metode VA) — ditampilkan tanpa redirect. */
  payment_va: string;
  /** String QRIS (bila metode QRIS) — dirender jadi QR di sisi kita. */
  payment_qr: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

const STORE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS store_orders (
    id TEXT PRIMARY KEY,
    ref_id TEXT NOT NULL UNIQUE,
    items TEXT NOT NULL DEFAULT '[]',
    buyer_name TEXT NOT NULL DEFAULT '',
    buyer_phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    district_label TEXT NOT NULL DEFAULT '',
    shipping_label TEXT NOT NULL DEFAULT '',
    subtotal INTEGER NOT NULL DEFAULT 0,
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    cod_fee INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    gateway_session TEXT NOT NULL DEFAULT '',
    gateway_trx TEXT NOT NULL DEFAULT '',
    payment_url TEXT NOT NULL DEFAULT '',
    payment_va TEXT NOT NULL DEFAULT '',
    payment_qr TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_store_orders_created
    ON store_orders (created_at DESC);
`;

export async function createStoreOrder(o: {
  id: string;
  ref_id: string;
  items: StoreOrderItem[];
  buyer_name: string;
  buyer_phone: string;
  address: string;
  note: string;
  district_label: string;
  shipping_label: string;
  subtotal: number;
  shipping_cost: number;
  cod_fee: number;
  total: number;
  payment_method: string;
}): Promise<StoreOrder> {
  const now = nowUtc();
  const row = await queryOne<StoreOrder>(
    `INSERT INTO store_orders
       (id, ref_id, items, buyer_name, buyer_phone, address, note,
        district_label,
        shipping_label, subtotal, shipping_cost, cod_fee, total,
        payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      o.id,
      o.ref_id,
      JSON.stringify(o.items),
      o.buyer_name,
      o.buyer_phone,
      o.address,
      o.note,
      o.district_label,
      o.shipping_label,
      o.subtotal,
      o.shipping_cost,
      o.cod_fee,
      o.total,
      o.payment_method,
      now,
      now,
    ],
  );
  if (!row) throw new Error("gagal menyimpan pesanan toko");
  return row;
}

export async function getStoreOrder(id: string): Promise<StoreOrder | undefined> {
  return queryOne<StoreOrder>("SELECT * FROM store_orders WHERE id = ?", [id]);
}

export async function getStoreOrderByRef(
  refId: string,
): Promise<StoreOrder | undefined> {
  return queryOne<StoreOrder>(
    "SELECT * FROM store_orders WHERE ref_id = ?",
    [refId],
  );
}

/** Simpan sesi pembayaran gateway hasil inquiry Duitku. */
export async function setStoreOrderSession(
  id: string,
  sessionId: string,
  paymentUrl: string,
  vaNumber = "",
  qrString = "",
): Promise<void> {
  await queryRun(
    `UPDATE store_orders
     SET gateway_session = ?, payment_url = ?, payment_va = ?, payment_qr = ?,
         updated_at = ?
     WHERE id = ?`,
    [sessionId, paymentUrl, vaNumber, qrString, nowUtc(), id],
  );
}

/** Tandai lunas (webhook Duitku terverifikasi). Idempoten. */
export async function markStoreOrderPaid(
  id: string,
  trxId = "",
  paidAt = nowUtc(),
): Promise<void> {
  await queryRun(
    `UPDATE store_orders
     SET payment_status = 'paid', gateway_trx = ?,
         error_message = '', updated_at = ?
     WHERE id = ? AND payment_status != 'paid'`,
    [trxId, paidAt, id],
  );
}

/** Tandai pembayaran gagal (webhook resultCode 01). */
export async function markStoreOrderFailed(
  id: string,
  message = "Pembayaran gagal",
): Promise<void> {
  await queryRun(
    "UPDATE store_orders SET payment_status = 'failed', error_message = ?, updated_at = ? WHERE id = ? AND payment_status = 'pending'",
    [message, nowUtc(), id],
  );
}
