"use client";

import { useState } from "react";
import { Play, Film } from "lucide-react";
import { getProductVideos, driveEmbedUrl, type ProductVideo } from "@/lib/product-videos";

function VideoCard({ video, isActive, onClick }: { video: ProductVideo; isActive: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${isActive
                    ? "border-brand bg-brand/5 shadow-sm"
                    : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                }`}
        >
            <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${isActive ? "bg-brand text-white" : "bg-gray-100 text-muted-2 group-hover:bg-brand/10 group-hover:text-brand"
                    }`}
            >
                <Play className="h-5 w-5" />
            </span>
            <span className={`text-sm font-medium ${isActive ? "text-brand" : "text-ink"}`}>
                {video.label || "Video Produk"}
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
        <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
                <Film className="h-6 w-6 text-brand" />
                Video Produk
            </h2>

            {/* Video player */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-black shadow-sm">
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

            {/* Video thumbnails/selector */}
            {videos.length > 1 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {videos.map((v, i) => (
                        <VideoCard
                            key={v.fileId}
                            video={v}
                            isActive={i === activeIdx}
                            onClick={() => setActiveIdx(i)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}