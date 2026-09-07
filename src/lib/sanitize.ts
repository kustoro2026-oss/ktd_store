/** Basic HTML sanitizer for scraped product descriptions. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    // Neutralize dangerous URL schemes (javascript: / data: / vbscript:)
    // instead of leaving them clickable.
    .replace(
      /\shref\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\1/gi,
      ' href="#"',
    )
    .replace(
      /\ssrc\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\1/gi,
      "",
    );
}
