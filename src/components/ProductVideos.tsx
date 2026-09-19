"use client";

import { useState } from "react";
import { Play, Film } from "lucide-react";
import { getProductVideos, driveStreamUrl } from "@/lib/product-videos";

export default function ProductVideos({ productId }: { productId: string }) {
    const videos = getProductVideos(productId);
    const [activeIdx, setActiveIdx] = useState(0);

    if (!videos.length) return null;

    const active = videos[Math.min(activeIdx, videos.length - 1)];

    return (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-2">
                <Film className="h-3.5 w-3.5 text-brand" />
                Video Produk
            </p>

            {/* Native video player — auto adapts orientation, no cropping */}
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    key={active.fileId}
                    src={driveStreamUrl(active.fileId)}
                    controls
                    playsInline
                    preload="metadata"
                    className="mx-auto block max-h-[70vh] w-full object-contain"
                />
            </div>

            {/* Video selector — always a 3-col grid, compact on all screens */}
            {videos.length > 1 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {videos.map((v, i) => {
                        const isActive = i === activeIdx;
                        return (
                            <button
                                key={v.fileId}
                                type="button"
                                onClick={() => setActiveIdx(i)}
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