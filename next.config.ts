import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Optimizer /_next/image Vercel menabrak kuota akun Hobby (respons 402
    // Payment Required) sehingga gambar gagal dimuat di produksi — terutama
    // gambar baru yang belum pernah di-cache edge. Semua file gambar di repo
    // sudah dioptimasi ukurannya, jadi sajikan langsung dari file asli.
    unoptimized: true,

    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "anekadropship.id",
      },
    ],
  },

  // Enable gzip/brotli compression
  compress: true,

  // Cache-Control headers for static assets
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Reduce bundle size
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
