import type { PostStatus } from '@evolvr/types';
import { Badge } from '@/components/ui/badge';

const statusConfig: Record<PostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  scheduled: { label: 'Scheduled', variant: 'info' },
  publishing: { label: 'Publishing', variant: 'warning' },
  published: { label: 'Published', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  waiting_approval: { label: 'Awaiting Review', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

interface PostStatusBadgeProps {
  status: PostStatus;
}

export function PostStatusBadge({ status }: PostStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
