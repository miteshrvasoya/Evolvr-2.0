import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-96" />
    </div>
  );
}
