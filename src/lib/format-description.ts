/**
 * Post-processor for scraped product descriptions.
 * Normalises inconsistent HTML from anekadropship into clean, professional,
 * consistently-formatted descriptions with emoji section icons.
 *
 * Pipeline: raw HTML → cleanDescription() → formatDescription() → sanitizeHtml()
 */

// ---------------------------------------------------------------------------
// Section detector: maps Indonesian (and some English) section keywords to
// emoji icons. Order matters — first match wins.
// ---------------------------------------------------------------------------

interface SectionRule {
    /** Regex tested against the candidate heading text (case-insensitive). */
    pattern: RegExp;
    /** Emoji icon prepended to the heading. */
    icon: string;
    /** Optional: force the canonical heading text (replaces the original). */
    canonical?: string;
}

const SECTION_RULES: SectionRule[] = [
    // Legal / certification
    {
        pattern: /\b(?:legalitas|bpom|halal|izin\s*edar|sertifikasi|pom|md\s*|bpom\s*ri)\b/i,
        icon: "📋",
        canonical: "LEGALITAS",
    },
    // Benefits
    {
        pattern: /\b(?:manfaat|khasiat|kegunaan|fungsi|keunggulan|kelebihan|benefit)\b/i,
        icon: "🌿",
        canonical: "MANFAAT",
    },
    // Variant / size options
    {
        pattern: /\b(?:pilihan\s*isi|varian|ukuran\s*tersedia|pilihan\s*ukuran|isi\s*kemasan|pilihan\s*varian|kemasan\s*tersedia)\b/i,
        icon: "📦",
        canonical: "PILIHAN ISI",
    },
    // How to use / consume
    {
        pattern: /\b(?:cara\s*(?:konsumsi|pakai|pemakaian|penggunaan|minum|saji|pakai|gunakan)|aturan\s*pakai|dosis|petunjuk\s*penggunaan|pemakaian|how\s*to\s*use|panduan\s*penggunaan)\b/i,
        icon: "🥤",
        canonical: "CARA KONSUMSI",
    },
    // Storage
    {
        pattern: /\b(?:penyimpanan|cara\s*simpan|masa\s*simpan|storage|cara\s*menyimpan|daya\s*simpan)\b/i,
        icon: "❄️",
        canonical: "PENYIMPANAN",
    },
    // Composition / ingredients
    {
        pattern: /\b(?:komposisi|bahan\s*(?:baku|utama|aktif)?|ingredient|kandungan|nutrisi|composition|isi\s*produk)\b/i,
        icon: "🧪",
        canonical: "KOMPOSISI",
    },
    // Tips
    {
        pattern: /\b(?:tips|saran|rekomendasi|trik|ide\s*penyajian)\b/i,
        icon: "🍯",
        canonical: "TIPS",
    },
    // Shipping / packaging
    {
        pattern: /\b(?:pengiriman|packing|kemasan|pengemasan|shipping|dikirim)\b/i,
        icon: "📦",
        canonical: "PENGIRIMAN",
    },
    // Description / about
    {
        pattern: /\b(?:deskripsi|tentang\s*produk|info\s*produk|detail\s*produk|spesifikasi|product\s*description|about)\b/i,
        icon: "📝",
        canonical: "DESKRIPSI",
    },
    // Warnings
    {
        pattern: /\b(?:peringatan|perhatian|efek\s*samping|kontraindikasi|warning|caution|penting|perlu\s*diperhatikan)\b/i,
        icon: "⚠️",
        canonical: "PENTING",
    },
    // Warranty / guarantee
    {
        pattern: /\b(?:garansi|jaminan|return|pengembalian|warranty|guarantee)\b/i,
        icon: "🛡️",
        canonical: "GARANSI",
    },
    // How to store / serve
    {
        pattern: /\b(?:cara\s*(?:penyajian|menyajikan|membuat)|serving\s*suggestion|saran\s*penyajian)\b/i,
        icon: "🍽️",
        canonical: "CARA PENYAJIAN",
    },
    // Expiry / durability
    {
        pattern: /\b(?:kedaluwarsa|exp|expired|kadaluarsa|masa\s*berlaku|expiry)\b/i,
        icon: "⏳",
        canonical: "MASA BERLAKU",
    },
    // Testimoni / review
    {
        pattern: /\b(?:testimoni|review|ulasan|testimony)\b/i,
        icon: "⭐",
        canonical: "TESTIMONI",
    },
    // Contact / customer service
    {
        pattern: /\b(?:kontak|hubungi|customer\s*service|cs|layanan|bantuan|info\s*pemesanan)\b/i,
        icon: "📞",
        canonical: "KONTAK",
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a text node looks like a section heading. */
function isHeadingCandidate(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    // Must be relatively short (headings aren't paragraphs).
    if (t.length > 80) return false;
    // Must not be a full sentence (no period in the middle).
    if (/[.!?]/.test(t.slice(0, -1))) return false;
    // Must have some "heading" characteristic:
    // - ALL CAPS
    // - Ends with colon
    // - Starts with a number (e.g. "1. Manfaat")
    // - Contains section keywords
    const isAllCaps = t === t.toUpperCase() && /[A-Z]{3,}/.test(t);
    const endsWithColon = t.endsWith(":");
    const startsWithNumber = /^\d+[.)]\s/.test(t);
    const hasSectionKeyword = SECTION_RULES.some((r) => r.pattern.test(t));
    return isAllCaps || endsWithColon || startsWithNumber || hasSectionKeyword;
}

/** Find the best-matching section rule for a heading text. */
function matchSection(heading: string): { icon: string; label: string } | null {
    const clean = heading.replace(/[:：]\s*$/, "").trim();
    for (const rule of SECTION_RULES) {
        if (rule.pattern.test(clean)) {
            return {
                icon: rule.icon,
                label: rule.canonical ?? clean.toUpperCase(),
            };
        }
    }
    // If it looks like a heading but no rule matched, still format it nicely.
    if (isHeadingCandidate(clean)) {
        return { icon: "📌", label: clean.toUpperCase() };
    }
    return null;
}

/** Collapse multiple consecutive <br> tags into at most two. */
function collapseBrs(html: string): string {
    return html.replace(/(?:\s*<br\s*\/?\s*>\s*){3,}/gi, "<br><br>");
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/**
 * Transform a cleaned HTML description into a consistently-formatted,
 * professional-looking description with emoji section icons.
 *
 * The input should already have passed through `cleanDescription()` which
 * strips inline styles, base64 images, seller guides, etc.
 */
export function formatDescription(html: string): string {
    if (!html) return "";

    let out = html;

    // ── 1. Collapse excessive <br> tags ──────────────────────────────────
    out = collapseBrs(out);

    // ── 2. Normalise heading-like <strong>/<b>/<span> into <h3> ──────────
    //    Patterns:
    //      <p><strong>MANFAAT:</strong></p>
    //      <p><b>MANFAAT</b></p>
    //      <p><span>MANFAAT:</span></p>
    //      <strong>MANFAAT:</strong><br>
    //      MANFAAT:<br>           (plain text followed by <br>)
    //      <p>MANFAAT:</p>
    //      <p>🍋 MANFAAT:</p>     (already has emoji — preserve it)

    // 2a. <p>...<strong>/<b>HEADING</strong>...</p> → <h3>
    out = out.replace(
        /<p[^>]*>\s*(?:<span[^>]*>)?\s*(?:<(?:strong|b)>)?\s*([^<]{3,80}?)\s*(?:<\/(?:strong|b)>)?\s*(?:<\/span>)?\s*<\/p>/gi,
        (_m: string, text: string) => {
            const t = text.trim();
            // Skip if it's a regular sentence (too long or contains sentence punctuation).
            if (!isHeadingCandidate(t)) return _m;
            const match = matchSection(t);
            if (!match) return _m;
            return `<h3>${match.icon} ${match.label}</h3>`;
        }
    );

    // 2b. <strong>/<b>HEADING</strong> followed by <br> (not inside <p>)
    out = out.replace(
        /<(?:strong|b)>\s*([^<]{3,80}?)\s*<\/(?:strong|b)>\s*(?:<br\s*\/?\s*>)+/gi,
        (_m: string, text: string) => {
            const t = text.trim();
            if (!isHeadingCandidate(t)) return _m;
            const match = matchSection(t);
            if (!match) return _m;
            return `<h3>${match.icon} ${match.label}</h3>`;
        }
    );

    // 2c. Plain text heading followed by <br> (e.g. "MANFAAT:<br>")
    //     Only match when preceded by > or start-of-string, and the text
    //     looks like a heading.
    out = out.replace(
        /(?:^|>)\s*([A-Z][A-Z\s]{2,60}?:?)\s*(?:<br\s*\/?\s*>)+/gm,
        (_m: string, text: string) => {
            const t = text.trim();
            if (!isHeadingCandidate(t)) return _m;
            const match = matchSection(t);
            if (!match) return _m;
            // Preserve the opening bracket/angle
            const prefix = _m.startsWith(">") ? ">" : "";
            return `${prefix}<h3>${match.icon} ${match.label}</h3>`;
        }
    );

    // 2d. <p>HEADING:</p> (plain paragraph that is actually a heading)
    out = out.replace(
        /<p[^>]*>\s*([^<]{3,80}?)\s*<\/p>/gi,
        (_m: string, text: string) => {
            const t = text.trim();
            if (!isHeadingCandidate(t)) return _m;
            const match = matchSection(t);
            if (!match) return _m;
            return `<h3>${match.icon} ${match.label}</h3>`;
        }
    );

    // ── 3. Normalise list markers ────────────────────────────────────────
    //    Convert various bullet styles to proper <ul>/<li>.
    //    Handles: "- item", "* item", "• item", "· item", "– item", "— item"
    //    Approach: convert known bullet markers to <li> items,
    //    then wrap consecutive <li>s in <ul>.

    // Replace bullet markers with <li>...</li>
    out = out.replace(
        /(?:^|>|<br\s*\/?\s*>)\s*(?:[-*•·–—])\s+([^<]+?)(?=<br\s*\/?\s*>|$)/gm,
        (_m: string, text: string) => {
            return `><li>${text.trim()}</li>`;
        }
    );

    // Replace numbered list markers (1. 2) etc.)
    out = out.replace(
        /(?:^|>|<br\s*\/?\s*>)\s*\d+[.)]\s+([^<]+?)(?=<br\s*\/?\s*>|$)/gm,
        (_m: string, text: string) => {
            return `><li>${text.trim()}</li>`;
        }
    );

    // 3b. Wrap consecutive <li> elements in <ul>.
    out = out.replace(
        /((?:<li>[^<]*<\/li>\s*){2,})/gi,
        "<ul>$1</ul>"
    );

    // ── 4. Clean up empty elements ───────────────────────────────────────
    out = out.replace(/<(p|div|span|ul|ol|li|h1|h2|h3|h4|h5|h6)[^>]*>\s*<\/\1>/gi, "");
    out = out.replace(/<p[^>]*>\s*(?:<br\s*\/?\s*>)+\s*<\/p>/gi, "");

    // ── 5. Ensure proper spacing between sections ────────────────────────
    //    Add a visual separator before each h3 (except the first).
    //    We do this via CSS, but ensure clean markup.

    // ── 6. Final cleanup ─────────────────────────────────────────────────
    // Collapse whitespace between tags
    out = out.replace(/>\s+</g, "><");
    // Remove leading/trailing whitespace
    out = out.trim();

    return out;
}