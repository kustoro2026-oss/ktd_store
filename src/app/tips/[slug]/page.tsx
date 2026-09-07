import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { blogPosts, getBlogPost } from "@/lib/data";

export function generateStaticParams() {
  return blogPosts.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Artikel Tidak Ditemukan" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/tips/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/tips/${post.slug}`,
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.image, alt: post.title }],
      siteName: "KTD Store",
      locale: "id_ID",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const others = blogPosts.filter((b) => b.slug !== post.slug);

  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <Link href="/tips" className="transition-colors hover:text-brand">Blog</Link>
        <span>/</span>
        <span className="truncate text-muted">{post.title}</span>
      </nav>

      <article className="mx-auto max-w-3xl">
        {/* Hero image */}
        <div className="relative h-52 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm sm:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Title */}
        <header className="mt-6">
          <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {post.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-2">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              Info &amp; Tips
            </span>
            {post.date}
          </p>
          <p className="mt-3 text-base font-medium leading-7 text-muted">
            {post.excerpt}
          </p>
        </header>

        {/* Content */}
        <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
          {post.content.map((p, i) => (
            <p key={i} className="text-sm leading-7 text-ink/80">
              {p}
            </p>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-bold text-ink">Cari produk yang sesuai?</p>
            <p className="mt-1 text-xs text-muted">
              Temukan produk terkait artikel ini di katalog kami.
            </p>
          </div>
          <Link
            href={`/produk?search=${encodeURIComponent(post.query)}`}
            className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
          >
            Lihat Produk Terkait
          </Link>
        </div>
      </article>

      {/* Other articles */}
      {others.length > 0 && (
        <section className="mx-auto mt-12 max-w-3xl">
          <h2 className="text-lg font-bold text-ink sm:text-xl">Artikel Lainnya</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((b) => (
              <Link
                key={b.slug}
                href={`/tips/${b.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.image}
                  alt={b.title}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg border border-gray-100 object-cover"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-ink transition-colors group-hover:text-brand">
                    {b.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-2">{b.date}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
