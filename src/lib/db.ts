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
  payment_status: PaymentStatus;
  topup_status: TopupStatus;
  /** Referensi transaksi dari payment gateway (Duitku reference). */
  gateway_session: string;
  /** ID transaksi dari payment gateway (Duitku publisherOrderId/reference). */
  gateway_trx: string;
  payment_url: string;
  paid_at: string;
  digiflazz_sn: string;
  error_message: string;
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

async function pgPool(): Promise<Pool> {
  if (!g.__ktdTopupPg) {
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: pgUrl() });
    await pool.query(SCHEMA_SQL);
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
    payment_status TEXT NOT NULL DEFAULT 'pending',
    topup_status TEXT NOT NULL DEFAULT 'waiting_payment',
    gateway_session TEXT NOT NULL DEFAULT '',
    gateway_trx TEXT NOT NULL DEFAULT '',
    payment_url TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT '',
    digiflazz_sn TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_topup_orders_created
    ON topup_orders (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_topup_orders_pending
    ON topup_orders (payment_status, topup_status);
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
}): Promise<TopUpOrder> {
  const now = nowUtc();
  const row = await queryOne<TopUpOrder>(
    `INSERT INTO topup_orders
       (id, ref_id, sku, product_name, customer_no, amount, cost,
        buyer_name, buyer_phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  return queryOne<TopUpOrder>(
    "SELECT * FROM topup_orders WHERE ref_id = ?",
    [refId],
  );
}

/** Simpan data sesi payment gateway hasil buat pembayaran. */
export async function setOrderPaymentSession(
  id: string,
  sessionId: string,
  paymentUrl: string,
): Promise<void> {
  await queryRun(
    "UPDATE topup_orders SET gateway_session = ?, payment_url = ?, updated_at = ? WHERE id = ?",
    [sessionId, paymentUrl, nowUtc(), id],
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

/** Daftar pesanan terbaru untuk panel admin. */
export async function listTopupOrders(limit = 10): Promise<TopUpOrder[]> {
  return queryAll<TopUpOrder>(
    "SELECT * FROM topup_orders ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
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
