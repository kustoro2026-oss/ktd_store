import sanitizeHtmlLib from "sanitize-html";

/** Sanitizer HTML untuk deskripsi produk hasil scrape anekadropship.id
 *  (konten pihak ketiga yang dirender via dangerouslySetInnerHTML).
 *
 *  Memakai parser HTML sungguhan dari library sanitize-html — jauh lebih
 *  tahan bypass dibanding sanitizer regex lama (href=javascript: tanpa
 *  kutip, entity-encoded scheme, dsb.). Tag yang tidak diizinkan dibuang
 *  bersama atribut event-handler dan URL berbahaya; teksnya tetap tampil.
 *
 *  Allowlist mengikuti markup asli deskripsi Aneka: paragraf, list, heading,
 *  tabel, gambar, dan tautan. Atribut inline style/dir sudah dibuang saat
 *  scrape (cleanDescription), jadi tidak perlu diizinkan di sini. */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p",
      "br",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "img",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["http", "https"],
    transformTags: {
      // Tautan keluar selalu nofollow + aman dari window.opener.
      a: sanitizeHtmlLib.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
      }),
    },
  });
}

/** Serialisasi JSON-LD aman untuk disuntikkan ke <script type="application/ld+json">.
 *  JSON.stringify TIDAK meng-escape urutan "</script>" — nama produk dari data
 *  supplier yang memuatnya akan memutus tag script dan menyuntikkan HTML.
 *  Escape "<" menjadi \u003c menutup celah itu tanpa mengubah JSON valid. */
export function escapeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
