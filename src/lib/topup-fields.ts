// Skema input form pembelian per provider (ala itemku) — file manual yang
// melengkapi katalog hasil generasi di topup.ts. Format customer_no mengikuti
// dokumentasi Digiflazz (kolom `desc` tiap SKU di price list):
// - Mobile Legends  : "user_id zone_id" (gabungan)
// - Genshin/HSR     : "[UID]|[Server]"
// - AOV/CoD Mobile  : "Masukkan PlayerID"
// - Valorant        : "Masukkan ID" (Riot ID: nama#tag)
// - PUBG/FF/FF Max  : ID game saja (kolom kosong = format standar ID)
// Field tambahan (nickname) hanya untuk verifikasi CS, TIDAK ikut customer_no.

export type TopUpFieldKey = "target" | "server" | "nickname";

export interface TopUpField {
  key: TopUpFieldKey;
  label: string;
  placeholder: string;
  /** Input angka saja (keypad numerik di HP). */
  numeric?: boolean;
  /** Panjang minimal/maksimal nilai (validasi ringan). */
  minLength?: number;
  maxLength?: number;
  /** Bila diisi, field dirender sebagai dropdown (server game). */
  options?: string[];
  /** Teks bantuan di bawah input — cara menemukan ID. */
  help?: string;
  /** Field tidak wajib (nickname) — tidak mempengaruhi customer_no. */
  optional?: boolean;
}

export interface ProviderFieldSchema {
  fields: TopUpField[];
  /** Ikon item nominal (diamond/UC/VP) yang tampil di kartu nominal. */
  icon?: string;
  /** Susun nilai field jadi customer_no Digiflazz. */
  compose: (v: Record<string, string>) => string;
}

const NUMERIC_ID = { numeric: true, minLength: 4, maxLength: 16 } as const;

const SCHEMAS: Record<string, ProviderFieldSchema> = {
  "free-fire": {
    icon: "/images/topup/icons/free-fire.svg",
    fields: [
      {
        key: "target",
        label: "Player ID",
        placeholder: "Contoh: 123456789",
        ...NUMERIC_ID,
        help: "Buka game, klik ikon karakter di pojok kiri atas. ID berupa angka di bawah nama karakter.",
      },
    ],
    compose: (v) => v.target.trim(),
  },
  "free-fire-max": {
    icon: "/images/topup/icons/free-fire-max.svg",
    fields: [
      {
        key: "target",
        label: "Player ID",
        placeholder: "Contoh: 123456789",
        ...NUMERIC_ID,
        help: "Buka game, klik ikon karakter di pojok kiri atas. ID berupa angka di bawah nama karakter.",
      },
    ],
    compose: (v) => v.target.trim(),
  },
  "mobile-legends": {
    icon: "/images/topup/icons/mobile-legends.svg",
    fields: [
      {
        key: "target",
        label: "User ID",
        placeholder: "Contoh: 12345678",
        ...NUMERIC_ID,
        help: "Buka profil MLBB, ID tertera di bawah avatar. Format gabungan User ID + Zone ID.",
      },
      {
        key: "server",
        label: "Zone ID",
        placeholder: "Contoh: 2020 (tanpa tanda kurung)",
        numeric: true,
        minLength: 4,
        maxLength: 6,
        help: "Angka di samping nama server, contoh (2020) → cukup isi 2020.",
      },
    ],
    compose: (v) => {
      const uid = v.target.trim();
      const zone = v.server.trim();
      return zone ? `${uid} ${zone}` : uid;
    },
  },
  "pubg-mobile": {
    icon: "/images/topup/icons/pubg-mobile.png",
    fields: [
      {
        key: "target",
        label: "User ID",
        placeholder: "Contoh: 5123456789",
        ...NUMERIC_ID,
        help: "Buka profil PUBG Mobile, User ID berupa angka di bawah avatar.",
      },
      {
        key: "nickname",
        label: "Nickname PUBG Mobile",
        placeholder: "Contoh: itemku2024",
        maxLength: 30,
        help: "Nama karakter untuk verifikasi pesanan (opsional).",
        optional: true,
      },
    ],
    compose: (v) => v.target.trim(),
  },
  valorant: {
    icon: "/images/topup/icons/valorant.png",
    fields: [
      {
        key: "target",
        label: "Riot ID",
        placeholder: "Contoh: iT3mKu123#ITMK",
        minLength: 3,
        maxLength: 22,
        help: "Riot ID = nama akun + tag, contoh: Username#1234. Lihat di profil Valorant.",
      },
    ],
    compose: (v) => v.target.trim(),
  },
  "genshin-impact": {
    icon: "/images/topup/icons/genshin-impact.png",
    fields: [
      {
        key: "target",
        label: "UID",
        placeholder: "Contoh: 800942687",
        ...NUMERIC_ID,
        help: "UID tertera di pojok kanan bawah layar game.",
      },
      {
        key: "server",
        label: "Server",
        placeholder: "Pilih Server",
        options: ["Asia", "America", "Europe", "TW, HK, MO"],
      },
    ],
    compose: (v) => `${v.target.trim()}|${v.server.trim()}`,
  },
  "honkai-star-rail": {
    icon: "/images/topup/icons/honkai-star-rail.png",
    fields: [
      {
        key: "target",
        label: "UID Honkai: Star Rail",
        placeholder: "Contoh: 801311343",
        ...NUMERIC_ID,
        help: "UID tertera di pojok kiri bawah layar game.",
      },
      {
        key: "server",
        label: "Server",
        placeholder: "Pilih Server",
        options: ["Asia", "America", "Europe", "TW, HK, MO"],
      },
    ],
    compose: (v) => `${v.target.trim()}|${v.server.trim()}`,
  },
  "arena-of-valor": {
    fields: [
      {
        key: "target",
        label: "Player ID",
        placeholder: "Contoh: 123456789",
        ...NUMERIC_ID,
        help: "Buka profil AOV, ID berupa angka di bawah avatar.",
      },
    ],
    compose: (v) => v.target.trim(),
  },
  "call-of-duty-mobile": {
    icon: "/images/topup/icons/call-of-duty-mobile.png",
    fields: [
      {
        key: "target",
        label: "Player ID CoD Mobile",
        placeholder: "Contoh: 501067480",
        ...NUMERIC_ID,
        help: "Buka profil CoD Mobile, ID berupa angka di bawah nama karakter.",
      },
      {
        key: "nickname",
        label: "Nickname CoD Mobile",
        placeholder: "Contoh: iTemKu",
        maxLength: 30,
        help: "Nama karakter untuk verifikasi pesanan (opsional).",
        optional: true,
      },
    ],
    compose: (v) => v.target.trim(),
  },
};

/** Skema bawaan: satu kolom sesuai customerNoLabel provider. */
function defaultSchema(slug: string, label: string, targetNumeric: boolean): ProviderFieldSchema {
  return {
    fields: [
      {
        key: "target",
        label,
        placeholder:
          label.toLowerCase().includes("hp") || label.toLowerCase().includes("meter")
            ? "Contoh: 08xxxxxxxxxx"
            : "Masukkan " + label,
        ...(targetNumeric ? { numeric: true, maxLength: 16 } : {}),
      },
    ],
    compose: (v) => v.target.trim(),
  };
}

import { providerBySlug } from "@/lib/topup";

/** Skema field untuk sebuah provider — dipakai form pembelian & validasi server. */
export function fieldsForProvider(slug: string): ProviderFieldSchema {
  const known = SCHEMAS[slug];
  if (known) return known;
  const p = providerBySlug(slug);
  return defaultSchema(slug, p?.customerNoLabel ?? "ID Tujuan", p?.targetNumeric ?? true);
}

/** Susun customer_no Digiflazz dari nilai form. */
export function composeCustomerNo(slug: string, values: Record<string, string>): string {
  return fieldsForProvider(slug).compose(values);
}
