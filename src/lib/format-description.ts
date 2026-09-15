/**
 * Post-processor for scraped product descriptions.
 * Uses cheerio to robustly parse and normalise inconsistent HTML from
 * anekadropship into clean, professional, consistently-formatted
 * descriptions with emoji section icons.
 *
 * Pipeline: raw HTML → cleanDescription() → formatDescription() → sanitizeHtml()
 */
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

// ---------------------------------------------------------------------------
// Section detector: maps Indonesian (and some English) section keywords to
// emoji icons. Order matters — first match wins.
// ---------------------------------------------------------------------------

interface SectionRule {
    pattern: RegExp;
    icon: string;
    canonical?: string;
}

const SECTION_RULES: SectionRule[] = [
    { pattern: /\b(?:legalitas|bpom|halal|izin\s*edar|sertifikasi|pom\b|md\s*\d|bpom\s*ri)\b/i, icon: "📋", canonical: "LEGALITAS" },
    { pattern: /\b(?:manfaat|khasiat|kegunaan|fungsi|keunggulan|kelebihan|benefit|keuntungan)\b/i, icon: "🌿", canonical: "MANFAAT" },
    { pattern: /\b(?:pilihan\s*isi|varian|ukuran\s*tersedia|pilihan\s*ukuran|isi\s*kemasan|pilihan\s*varian|kemasan\s*tersedia|isi\s*bersih)\b/i, icon: "📦", canonical: "PILIHAN ISI" },
    { pattern: /\b(?:cara\s*(?:konsumsi|pakai|pemakaian|penggunaan|minum|saji|gunakan)|aturan\s*pakai|dosis|petunjuk\s*penggunaan|pemakaian|how\s*to\s*use|panduan\s*penggunaan)\b/i, icon: "🥤", canonical: "CARA KONSUMSI" },
    { pattern: /\b(?:penyimpanan|cara\s*simpan|masa\s*simpan|storage|cara\s*menyimpan|daya\s*simpan)\b/i, icon: "❄️", canonical: "PENYIMPANAN" },
    { pattern: /\b(?:komposisi|bahan\s*(?:baku|utama|aktif)|ingredient|kandungan|nutrisi|composition)\b/i, icon: "🧪", canonical: "KOMPOSISI" },
    { pattern: /\b(?:tips|saran|rekomendasi|trik|ide\s*penyajian)\b/i, icon: "🍯", canonical: "TIPS" },
    { pattern: /\b(?:spesifikasi|isi\s*&\s*spesifikasi|isi\s*dan\s*spesifikasi)\b/i, icon: "📦", canonical: "SPESIFIKASI" },
    { pattern: /\b(?:pengiriman|packing|pengemasan|shipping|dikirim)\b/i, icon: "📦", canonical: "PENGIRIMAN" },
    { pattern: /\b(?:deskripsi|tentang\s*produk|info\s*produk|detail\s*produk|product\s*description)\b/i, icon: "📝", canonical: "DESKRIPSI" },
    { pattern: /\b(?:peringatan|perhatian|efek\s*samping|kontraindikasi|warning|caution|penting|perlu\s*diperhatikan|note|catatan)\b/i, icon: "⚠️", canonical: "PENTING" },
    { pattern: /\b(?:garansi|jaminan|return|pengembalian|warranty|guarantee)\b/i, icon: "🛡️", canonical: "GARANSI" },
    { pattern: /\b(?:cara\s*(?:penyajian|menyajikan|membuat)|serving\s*suggestion|saran\s*penyajian)\b/i, icon: "🍽️", canonical: "CARA PENYAJIAN" },
    { pattern: /\b(?:kedaluwarsa|exp|expired|kadaluarsa|masa\s*berlaku|expiry)\b/i, icon: "⏳", canonical: "MASA BERLAKU" },
    { pattern: /\b(?:testimoni|review|ulasan|testimony)\b/i, icon: "⭐", canonical: "TESTIMONI" },
    { pattern: /\b(?:kontak|hubungi|customer\s*service|cs\b|layanan|bantuan|info\s*pemesanan)\b/i, icon: "📞", canonical: "KONTAK" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip emoji characters from text for pattern matching. */
function stripEmoji(text: string): string {
    return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{200D}\u{FE0F}\u{20E3}]/gu, "").trim();
}

/** Check if text looks like a section heading (not a regular sentence). */
function isHeadingText(text: string): boolean {
    const raw = text.trim();
    if (!raw || raw.length > 80) return false;
    // Skip if it contains sentence-ending punctuation mid-text
    if (/[.!?]/.test(raw.slice(0, -1))) return false;

    // Strip emoji for pattern matching (handles already-formatted headings)
    const t = stripEmoji(raw);
    if (!t || t.length < 2) return false;

    // ALL CAPS (at least 3 letters)
    if (t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) return true;
    // Ends with colon
    if (t.endsWith(":") || t.endsWith("：")) return true;
    // Contains a known section keyword — but only near the START (first 40 chars),
    // not buried in parentheses like "(Kemasan Pink)"
    const first40 = t.slice(0, 40);
    if (SECTION_RULES.some((r) => r.pattern.test(first40))) return true;
    // Starts with number + short text (e.g. "1. Manfaat") — but NOT long list items
    if (/^\d+[.)]\s/.test(t) && t.length <= 40) return true;

    return false;
}

/** Match a heading text to a section rule. */
function matchSection(heading: string): { icon: string; label: string } | null {
    const clean = stripEmoji(heading).replace(/[:：]\s*$/, "").trim();
    if (!clean) return null;
    for (const rule of SECTION_RULES) {
        if (rule.pattern.test(clean)) {
            return { icon: rule.icon, label: rule.canonical ?? clean.toUpperCase() };
        }
    }
    if (isHeadingText(heading)) {
        return { icon: "📌", label: clean.toUpperCase() };
    }
    return null;
}

/** Check if an element is essentially empty (no text content). */
function isEmptyElement($: cheerio.CheerioAPI, el: AnyNode): boolean {
    const text = $(el).text().trim();
    return !text;
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/**
 * Transform a cleaned HTML description into a consistently-formatted,
 * professional-looking description with emoji section icons.
 */
export function formatDescription(html: string): string {
    if (!html) return "";

    const $ = cheerio.load(html);

    // ── 1. Strip ALL non-semantic attributes ─────────────────────────────
    const STRIP_ATTRS = /^(_ngcontent|_nghost|data-path-to-node|data-index-in-node|data-sku|data-address|class|style|dir|align|valign|bgcolor|width|height|border|cellpadding|cellspacing)$/;
    $("*").each((_, el) => {
        if (el.type !== "tag") return;
        const attrs = Object.keys(el.attribs || {});
        for (const attr of attrs) {
            if (STRIP_ATTRS.test(attr) || attr.startsWith("data-") || attr.startsWith("_ng")) {
                $(el).removeAttr(attr);
            }
        }
    });

    // ── 2. Unwrap useless wrappers ──────────────────────────────────────
    $("message-content, div.container").each((_, el) => {
        $(el).replaceWith($(el).html() ?? "");
    });

    // ── 2b. Unwrap single <ol><li> that wraps the entire body content ──
    //    (some suppliers put the whole description in one list item)
    const bodyChildren = $("body").children();
    if (bodyChildren.length === 1 && bodyChildren.first().is("ol")) {
        const ol = bodyChildren.first();
        if (ol.children().length === 1 && ol.children().first().is("li")) {
            const li = ol.children().first();
            ol.replaceWith(li.html() ?? "");
        }
    }

    // ── 3. Downgrade <h1> → <strong> (suppliers use <h1> for content) ──
    $("h1").each((_, el) => {
        const $el = $(el);
        if ($el.find("ul, ol, p, div").length > 0) {
            $el.replaceWith($el.html() ?? "");
        } else {
            $el.replaceWith(`<p><strong>${$el.text().trim()}</strong></p>`);
        }
    });

    // ── 4. Downgrade <h2> → <strong> ────────────────────────────────────
    $("h2").each((_, el) => {
        const $el = $(el);
        if ($el.find("ul, ol, p, div").length > 0) {
            $el.replaceWith($el.html() ?? "");
        } else {
            $el.replaceWith(`<p><strong>${$el.text().trim()}</strong></p>`);
        }
    });

    // ── 5. Unwrap <span> inside heading tags so text can be detected ──
    $("h3 > span, h4 > span, h5 > span, h6 > span").each((_, el) => {
        $(el).replaceWith($(el).text());
    });

    // ── 6. Detect section headings and convert to <h3> with emoji ───────
    const headingTags = "p, strong, b, span, h3, h4, h5, h6";
    const convertedSigs = new Set<string>();

    $(headingTags).each((_, el) => {
        const $el = $(el);
        // Skip if inside an <h3> (but not if it IS the h3 itself)
        if ($el.parent().closest("h3").length > 0) return;
        // Skip if inside a list item AND has sibling text (inline label like "Netto: 50g"),
        // but NOT if it's the sole content of a <p> (standalone heading like "Komposisi")
        if ($el.closest("li").length > 0) {
            const parent = $el.parent();
            const parentText = parent.text().trim();
            const elText = $el.text().trim();
            // If the parent has more text than just this element, it's an inline label
            if (parentText !== elText) return;
        }
        // Skip if the element contains nested block elements
        if ($el.find("ul, ol, p, div, h1, h2, h3, h4, h5, h6").length > 0) return;

        const text = $el.text().trim();
        if (!text || text.length > 80) return;
        if (!isHeadingText(text)) return;

        const match = matchSection(text);
        if (!match) return;

        const sig = `${match.icon} ${match.label}`;
        if (convertedSigs.has(sig)) {
            // Remove duplicate
            const parent = $el.parent();
            if (parent.is("p") && parent.contents().length === 1) {
                parent.remove();
            } else {
                $el.remove();
            }
            return;
        }
        convertedSigs.add(sig);

        // Replace with <h3>
        if (el.tagName === "p") {
            $el.replaceWith(`<h3>${sig}</h3>`);
        } else if (el.tagName === "strong" || el.tagName === "b") {
            const parent = $el.parent();
            if (parent.is("p") && parent.contents().length === 1) {
                parent.replaceWith(`<h3>${sig}</h3>`);
            } else {
                $el.replaceWith(`<h3>${sig}</h3>`);
            }
        } else if (el.tagName === "span") {
            const parent = $el.parent();
            if (parent.is("p") && parent.contents().length === 1) {
                parent.replaceWith(`<h3>${sig}</h3>`);
            } else {
                $el.replaceWith(`<h3>${sig}</h3>`);
            }
        } else {
            // h3, h4, h5, h6 — just update text
            $el.text(sig);
        }
    });

    // ── 6. Convert numbered <p> sequences to <ol> ───────────────────────
    //    Process body children in order, grouping consecutive numbered <p>s.
    const body = $("body");
    const children = body.children().toArray();
    const toWrap: AnyNode[][] = [];
    let currentGroup: AnyNode[] = [];

    for (const child of children) {
        if (child.type !== "tag" || child.tagName !== "p") {
            if (currentGroup.length >= 2) toWrap.push(currentGroup);
            currentGroup = [];
            continue;
        }
        const text = $(child).text().trim();
        if (/^\d+[.)]\s/.test(text)) {
            currentGroup.push(child);
        } else {
            if (currentGroup.length >= 2) toWrap.push(currentGroup);
            currentGroup = [];
        }
    }
    if (currentGroup.length >= 2) toWrap.push(currentGroup);

    for (const group of toWrap) {
        const first = $(group[0]);
        const ol = $("<ol></ol>");
        for (const item of group) {
            const itemText = $(item).text().trim().replace(/^\d+[.)]\s*/, "");
            ol.append(`<li>${itemText}</li>`);
        }
        // Insert BEFORE removing items so first.before() works
        first.before(ol);
        for (const item of group) {
            $(item).remove();
        }
    }

    // ── 7. Convert bullet-point <p> sequences to <ul> ───────────────────
    const children2 = body.children().toArray();
    const bulletGroups: AnyNode[][] = [];
    let bulletGroup: AnyNode[] = [];

    for (const child of children2) {
        if (child.type !== "tag" || child.tagName !== "p") {
            if (bulletGroup.length >= 1) bulletGroups.push(bulletGroup);
            bulletGroup = [];
            continue;
        }
        const text = $(child).text().trim();
        if (/^[-*•·–—]\s/.test(text)) {
            bulletGroup.push(child);
        } else {
            if (bulletGroup.length >= 1) bulletGroups.push(bulletGroup);
            bulletGroup = [];
        }
    }
    if (bulletGroup.length >= 1) bulletGroups.push(bulletGroup);

    for (const group of bulletGroups) {
        const first = $(group[0]);
        const ul = $("<ul></ul>");
        for (const item of group) {
            const itemText = $(item).text().trim().replace(/^[-*•·–—]\s*/, "");
            ul.append(`<li>${itemText}</li>`);
        }
        // Insert BEFORE removing items
        first.before(ul);
        for (const item of group) {
            $(item).remove();
        }
    }

    // ── 8. Remove empty elements ────────────────────────────────────────
    $("p, div, span, strong, b, h3, h4, h5, h6, ul, ol, li").each((_, el) => {
        if (isEmptyElement($, el)) {
            $(el).remove();
        }
    });

    // ── 9. Remove duplicate consecutive <h3> headings ───────────────────
    const seenH3 = new Set<string>();
    $("h3").each((_, el) => {
        const sig = $(el).text().trim();
        if (seenH3.has(sig)) {
            $(el).remove();
        } else {
            seenH3.add(sig);
        }
    });

    // ── 10. Clean up orphan <br> ────────────────────────────────────────
    $("br").each((_, el) => {
        const parent = $(el).parent();
        if (parent.is("body") && parent.contents().length === 1) {
            $(el).remove();
        }
    });

    // ── 11. Extract body HTML ───────────────────────────────────────────
    let result = $("body").html() ?? "";

    // ── 12. Final cleanup ───────────────────────────────────────────────
    result = result.replace(/(?:\s*<br\s*\/?\s*>\s*){3,}/gi, "<br><br>");
    result = result.replace(/<p[^>]*>\s*(?:<br\s*\/?\s*>)*\s*<\/p>/gi, "");
    result = result.replace(/<!--[\s\S]*?-->/g, "");
    result = result.replace(/>\s+</g, "><");
    result = result.trim();

    return result;
}