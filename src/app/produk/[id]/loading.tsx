/** Skeleton shown while a product detail page server-renders. */
export default function Loading() {
  return (
    <div className="container-site py-5">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-gray-100" />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gallery placeholder */}
        <div className="space-y-3">
          <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-gray-100" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 w-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
        {/* Info placeholder */}
        <div className="space-y-3">
          <div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-1/3 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
