"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/**
 * Base Meta Pixel + PageView (client component di root layout).
 *
 * - Script fbevents.js dimuat sekali dengan strategy "afterInteractive".
 * - PageView pertama dikirim oleh snippet inline saat script dieksekusi;
 *   navigasi SPA berikutnya dikirim oleh effect yang memantau pathname
 *   (ref mencegah duplikat saat StrictMode / re-render).
 * - Tanpa NEXT_PUBLIC_META_PIXEL_ID komponen tidak merender apa pun,
 *   jadi aman untuk development maupun preview tanpa iklan.
 */
export default function MetaPixel() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // PageView awal sudah dikirim oleh snippet inline — catat path pertama
    // tanpa mengirim ulang, lalu kirim hanya saat path benar-benar berubah.
    if (lastTrackedPath.current === null || lastTrackedPath.current === pathname) {
      lastTrackedPath.current = pathname;
      return;
    }
    lastTrackedPath.current = pathname;
    if (typeof window.fbq === "function") window.fbq("track", "PageView");
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
