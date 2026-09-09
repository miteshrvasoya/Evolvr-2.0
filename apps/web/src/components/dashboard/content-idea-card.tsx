import type { ContentIdea } from '@evolvr/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';

interface ContentIdeaCardProps {
  idea: ContentIdea;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

const formatColors: Record<string, 'info' | 'success' | 'warning' | 'secondary'> = {
  reel: 'info',
  carousel: 'success',
  static: 'secondary',
  story: 'warning',
  live: 'warning',
};

export function ContentIdeaCard({ idea, onApprove, onReject, showActions }: ContentIdeaCardProps) {
  const variant = formatColors[idea.format] ?? 'secondary';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={variant} className="capitalize">{idea.format}</Badge>
            <Badge variant="outline" className="capitalize">{idea.pillar}</Badge>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            Score: {(idea.score.aggregate * 100).toFixed(0)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium text-sm">{idea.concept}</p>
        <p className="text-sm text-muted-foreground italic line-clamp-2">&ldquo;{idea.hook}&rdquo;</p>
        {idea.caption && (
          <p className="text-xs text-muted-foreground line-clamp-3">{idea.caption}</p>
        )}

        {/* Score breakdown */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
          <span>Strategy Fit: {(idea.score.strategyFit * 100).toFixed(0)}%</span>
          <span>Audience Fit: {(idea.score.audienceFit * 100).toFixed(0)}%</span>
          <span>Novelty: {(idea.score.novelty * 100).toFixed(0)}%</span>
          <span>Brand Safety: {(idea.score.brandSafety * 100).toFixed(0)}%</span>
        </div>

        {idea.policyDecision && (
          <div className="rounded-md bg-muted p-2 text-xs">
            <span className="font-medium capitalize">Policy: {idea.policyDecision.decision}</span>
            {idea.policyDecision.reasons.length > 0 && (
              <p className="text-muted-foreground mt-0.5">{idea.policyDecision.reasons[0]}</p>
            )}
          </div>
        )}

        {showActions && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onApprove}
              className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 rounded-md border border-destructive py-1.5 text-xs font-medium text-destructive hover:bg-destructive hover:text-white transition-colors"
            >
              Reject
            </button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{formatDateTime(idea.createdAt)}</p>
      </CardContent>
    </Card>
  );
}
