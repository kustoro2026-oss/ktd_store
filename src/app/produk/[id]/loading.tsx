export default function ProductDetailLoading() {
  return (
    <div className="container-site py-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-gray-100" />
        <div className="space-y-4">
          <div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
