import { Skeleton } from '@/components/ui/skeleton';

export default function StrategyLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
