import { Skeleton } from '@/components/ui/skeleton';

export default function ContentLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-96" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
