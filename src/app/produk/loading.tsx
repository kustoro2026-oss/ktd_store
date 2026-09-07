/** Skeleton shown while the product listing server-renders. */
export default function Loading() {
  return (
    <div className="container-site py-5">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-gray-100" />
      <div className="mb-6 h-7 w-64 animate-pulse rounded bg-gray-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-gray-100" />
            <div className="space-y-2 p-3">
              <div className="h-3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
