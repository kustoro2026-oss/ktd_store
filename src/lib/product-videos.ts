/**
 * Product video mapping.
 * Maps product IDs to Google Drive video URLs.
 * Videos are displayed below the product description on the detail page.
 *
 * Google Drive URL format:
 *   https://drive.google.com/file/d/{FILE_ID}/view
 * Embed format:
 *   https://drive.google.com/file/d/{FILE_ID}/preview
 */

export type ProductVideo = {
    /** Google Drive file ID */
    fileId: string;
    /** Optional label (e.g. "Testimoni 1", "Cara Pakai") */
    label?: string;
};

const VIDEOS: Record<string, ProductVideo[]> = {
    "2149": [
        { fileId: "1u8elh5GSB6xREvWcW7Hw9LhDja8fXqQH", label: "Video Produk 1" },
        { fileId: "1j3KlgD0-DH0gjzdQF8y5nrvcvud5CquW", label: "Video Produk 2" },
        { fileId: "1dZRlBcV39-Ppnlg-y-i-CZ-ihYGsBuUi", label: "Video Produk 3" },
    ],
};

/** Get video list for a product, or empty array if none. */
export function getProductVideos(productId: string): ProductVideo[] {
    return VIDEOS[productId] ?? [];
}

/** Convert Google Drive file ID to embed URL. */
export function driveEmbedUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`;
}