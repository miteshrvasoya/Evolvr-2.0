import type { Experiment } from '@evolvr/types';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ExperimentRowProps {
  experiment: Experiment;
}

const statusColors: Record<string, 'info' | 'success' | 'secondary' | 'destructive'> = {
  planned: 'secondary',
  running: 'info',
  concluded: 'success',
  cancelled: 'destructive',
};

export function ExperimentRow({ experiment }: ExperimentRowProps) {
  const variant = statusColors[experiment.status] ?? 'secondary';
  const daysLeft =
    experiment.status === 'running'
      ? Math.ceil((new Date(experiment.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40 transition-colors">
      <td className="py-3 pr-4 text-sm font-medium">{experiment.name}</td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">{experiment.variable}</td>
      <td className="py-3 pr-4 text-sm text-muted-foreground capitalize">
        {experiment.primaryMetric.replace(/_/g, ' ')}
      </td>
      <td className="py-3 pr-4">
        <Badge variant={variant} className="capitalize">{experiment.status}</Badge>
      </td>
      <td className="py-3 text-sm text-muted-foreground">
        {daysLeft !== null ? `${daysLeft}d left` : formatDate(experiment.endAt)}
      </td>
    </tr>
  );
}
