import { Skeleton } from '@/components/ui/skeleton';

export default function ResearchLoading() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24" />)}
      </div>
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
  );
}
