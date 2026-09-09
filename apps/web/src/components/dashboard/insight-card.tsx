import type { StrategicInsight } from '@evolvr/types';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface InsightCardProps {
  insight: StrategicInsight;
}

const categoryColors: Record<string, 'info' | 'warning' | 'success' | 'secondary'> = {
  content_format: 'info',
  hook_type: 'info',
  topic: 'success',
  posting_time: 'warning',
  audience_behavior: 'secondary',
  competitor: 'warning',
  platform_algorithm: 'info',
};

export function InsightCard({ insight }: InsightCardProps) {
  const variant = categoryColors[insight.category] ?? 'secondary';

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant={variant} className="text-xs capitalize">
            {insight.category.replace(/_/g, ' ')}
          </Badge>
          <span className="text-xs text-muted-foreground shrink-0">
            {(insight.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        <p className="text-sm">{insight.statement}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{insight.evidence.length} data points</span>
          <span>{formatDate(insight.createdAt)}</span>
          <span className="capitalize">{insight.scope}</span>
        </div>
        {/* Confidence bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${insight.confidence * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
