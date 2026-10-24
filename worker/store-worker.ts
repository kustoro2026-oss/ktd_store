// Worker VPS KTD Store — perawatan harian top-up (pengganti cron Vercel).
// Jalankan dari root repo ktd-store:
//
//   npx tsx worker/store-worker.ts
//
// Jadwal harian (UTC, meniru vercel.json):
//   00:00  cek saldo + snapshot kesehatan + sinkron katalog
//   03:17  kedaluwarsakan pesanan menggantung + cek ulang Pending
// Toleransi +5 menit supaya ronde tidak hilang saat sibuk; kunci per-tanggal
// mencegah dobel saat restart.
import {
  runDailyTopupMaintenance,
  runDailyPendingMaintenance,
} from "../src/lib/topup-daily";

function wib(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 19);
}

function log(msg: string): void {
  console.log(`[store-worker ${wib()}] ${msg}`);
}

const DAILY_JOBS: {
  name: string;
  h: number;
  m: number;
  run: () => Promise<unknown>;
}[] = [
  {
    name: "cek-saldo",
    h: 0,
    m: 0,
    run: () => runDailyTopupMaintenance(),
  },
  {
    name: "pending",
    h: 3,
    m: 17,
    run: () => runDailyPendingMaintenance(),
  },
];

const lastDaily = new Set<string>();

function dateKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

async function tick(): Promise<void> {
  const d = new Date();
  const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  const dk = dateKeyUtc(d);
  for (const job of DAILY_JOBS) {
    const at = job.h * 60 + job.m;
    if (nowMin < at || nowMin >= at + 5) continue;
    const key = `${job.name}:${dk}`;
    if (lastDaily.has(key)) continue;
    lastDaily.add(key);
    log(`jadwal harian: ${job.name}`);
    try {
      const res = (await job.run()) as { ok?: boolean };
      log(
        `jadwal harian selesai: ${job.name} — ${
          res && res.ok === false ? "GAGAL (ok:false)" : "ok"
        }`,
      );
    } catch (e) {
      log(
        `jadwal harian GAGAL: ${job.name} — ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}

async function main(): Promise<void> {
  log("start — loop tiap menit (jadwal harian 00:00 & 03:17 UTC)");
  const run = () =>
    tick().catch((e) =>
      log(`tick GAGAL: ${e instanceof Error ? e.message : String(e)}`),
    );
  setInterval(run, 60_000);
  void run();
}

void main();
