"use client";

import { useState } from "react";
import { Play, Film, ExternalLink } from "lucide-react";
import { getProductVideos, driveStreamUrl } from "@/lib/product-videos";

export default function ProductVideos({ productId }: { productId: string }) {
    const videos = getProductVideos(productId);
    const [activeIdx, setActiveIdx] = useState(0);
    const [videoError, setVideoError] = useState(false);

    if (!videos.length) return null;

    const active = videos[Math.min(activeIdx, videos.length - 1)];

    return (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-2">
                <Film className="h-3.5 w-3.5 text-brand" />
                Video Produk
            </p>

            {/* Native video player — auto adapts orientation (portrait/landscape) */}
            <div className="mt-3 flex items-center justify-center overflow-hidden rounded-xl bg-black">
                {videoError ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2 py-10 text-center">
                        <p className="text-xs text-white/80">Video tidak dapat diputar langsung.</p>
                        <a
                            href={`https://drive.google.com/file/d/${active.fileId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Buka di Google Drive
                        </a>
                    </div>
                ) : (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
                    <video
                        key={active.fileId}
                        src={driveStreamUrl(active.fileId)}
                        controls
                        playsInline
                        preload="metadata"
                        onError={() => setVideoError(true)}
                        className="max-h-[60vh] w-full object-contain"
                    />
                )}
            </div>

            <a
                href={`https://drive.google.com/file/d/${active.fileId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
                <ExternalLink className="h-3 w-3" />
                Buka di Google Drive
            </a>

            {/* Video selector — always a 3-col grid, compact on all screens */}
            {videos.length > 1 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {videos.map((v, i) => {
                        const isActive = i === activeIdx;
                        return (
                            <button
                                key={v.fileId}
                                type="button"
                                onClick={() => {
                                    setActiveIdx(i);
                                    setVideoError(false);
                                }}
                                aria-label={v.label || `Video ${i + 1}`}
                                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-all ${isActive
                                        ? "border-brand bg-brand/5 text-brand"
                                        : "border-gray-100 bg-white text-muted-2 hover:border-gray-200 hover:text-brand"
                                    }`}
                            >
                                <span
                                    className={`flex h-7 w-7 items-center justify-center rounded-full ${isActive ? "bg-brand text-white" : "bg-gray-100"
                                        }`}
                                >
                                    <Play className="h-3.5 w-3.5" />
                                </span>
                                <span className="w-full truncate text-center text-[11px] font-medium">
                                    {v.label || `Video ${i + 1}`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}