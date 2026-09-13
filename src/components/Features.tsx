import { MessageCircle, ShieldCheck, ShoppingCart, Tag } from "lucide-react";

/** Trust / value proposition strip — server component (no state needed) */
export default function Features() {
    const items = [
        { icon: Tag, title: "Langsung dari supplier", desc: "" },
        { icon: ShoppingCart, title: "Pesan via WhatsApp", desc: "Cepat & praktis" },
        { icon: ShieldCheck, title: "Transaksi Aman", desc: "Pesanan terlindungi" },
        { icon: MessageCircle, title: "CS Siap Bantu", desc: "Setiap hari via WhatsApp" },
    ];
    return (
        <section className="container-site mt-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {items.map((it) => (
                    <div
                        key={it.title}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
                            <it.icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{it.title}</p>
                            {it.desc ? <p className="truncate text-xs text-muted-2">{it.desc}</p> : null}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}