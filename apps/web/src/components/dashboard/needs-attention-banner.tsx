'use client';

import Link from 'next/link';
import { useNeedsAttention } from '@/lib/hooks/use-content-library';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const FORMAT_LABELS: Record<string, string> = {
  reel:        'Reel',
  carousel:    'Carousel',
  static_post: 'Static Post',
  story:       'Story',
};

export function NeedsAttentionBanner({ className }: { className?: string }) {
  const { items, count, isLoading } = useNeedsAttention();

  if (isLoading) return null;

  if (count === 0) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400',
        className
      )}>
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        All generated assets are healthy — no action required.
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-orange-200/60 dark:border-orange-800/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-sm font-semibold text-orange-800 dark:text-orange-400">
            {count} item{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} attention
          </span>
        </div>
        <Link
          href="/dashboard/content?assetStatus=failed"
          className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Item list */}
      <div className="divide-y divide-orange-100 dark:divide-orange-900/30">
        {items.slice(0, 5).map(item => (
          <Link
            key={item.id}
            href={`/dashboard/content/${item.id}`}
            className="flex items-start gap-3 px-4 py-2.5 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge variant="outline" className="text-[10px] capitalize px-1 h-4">
                  {FORMAT_LABELS[item.format] || item.format}
                </Badge>
              </div>
              <p className="text-xs text-orange-800 dark:text-orange-400 line-clamp-1 font-medium">
                {item.hook || item.concept}
              </p>
              {item.needsAttentionReason && (
                <p className="text-[10px] text-orange-600/70 dark:text-orange-500/70 line-clamp-1 mt-0.5">
                  {item.needsAttentionReason}
                </p>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {count > 5 && (
        <div className="px-4 py-2 border-t border-orange-200/60 dark:border-orange-800/60">
          <Link
            href="/dashboard/content?assetStatus=failed"
            className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
          >
            + {count - 5} more — view all
          </Link>
        </div>
      )}
    </div>
  );
}
