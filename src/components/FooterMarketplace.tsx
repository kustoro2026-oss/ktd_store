"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { marketplaces } from "@/lib/config";
import MarketplaceIcon from "@/components/MarketplaceIcon";
import MarketplaceNotice from "@/components/MarketplaceNotice";

export default function FooterMarketplace() {
    const [missingMp, setMissingMp] = useState<string | null>(null);

    return (
        <div>
            <h3 className="text-base font-bold text-ink">Belanja di Marketplace</h3>
            <p className="mt-3 text-sm text-muted">
                Pesan melalui WhatsApp — marketplace resmi segera menyusul.
            </p>
            {missingMp && (
                <div className="mt-3">
                    <MarketplaceNotice
                        label={missingMp}
                        onClose={() => setMissingMp(null)}
                        message={
                            <>
                                Toko KTD Store belum tersedia di <b>{missingMp}</b>. Silakan
                                pesan melalui WhatsApp untuk saat ini.
                            </>
                        }
                    />
                </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
                {marketplaces.map((m) => (
                    <button
                        key={m.key}
                        type="button"
                        onClick={() => setMissingMp(m.label)}
                        className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                        <span className="flex h-9 w-20 shrink-0 items-center justify-center">
                            <MarketplaceIcon name={m.key} className="h-5 w-auto max-w-full object-contain" />
                        </span>
                        <span className="text-ink">{m.label}</span>
                        <ArrowRight className="ml-auto h-4 w-4 text-muted-2" aria-hidden="true" />
                    </button>
                ))}
            </div>
        </div>
    );
}