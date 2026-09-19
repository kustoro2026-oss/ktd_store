"use client";

import { useState } from "react";
import { Play, Film } from "lucide-react";
import { getProductVideos, driveEmbedUrl, type ProductVideo } from "@/lib/product-videos";

function VideoTab({ video, isActive, onClick }: { video: ProductVideo; isActive: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${isActive
                    ? "border-brand bg-brand/5"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
        >
            <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isActive ? "bg-brand text-white" : "bg-gray-100 text-muted-2"
                    }`}
            >
                <Play className="h-3.5 w-3.5" />
            </span>
            <span className={`truncate text-xs font-medium ${isActive ? "text-brand" : "text-ink"}`}>
                {video.label || "Video"}
            </span>
        </button>
    );
}

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

            {/* Video player — responsive 16:9 */}
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-black">
                <div className="relative aspect-video w-full">
                    <iframe
                        src={driveEmbedUrl(active.fileId)}
                        title={active.label || "Video Produk"}
                        className="absolute inset-0 h-full w-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                    />
                </div>
            </div>

            {/* Video selector — horizontal scroll on mobile, grid on desktop */}
            {videos.length > 1 && (
                <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible">
                    {videos.map((v, i) => (
                        <VideoTab
                            key={v.fileId}
                            video={v}
                            isActive={i === activeIdx}
                            onClick={() => setActiveIdx(i)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}