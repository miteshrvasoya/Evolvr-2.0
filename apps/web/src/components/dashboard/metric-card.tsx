'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number; // positive = up, negative = down
  format?: 'number' | 'percent' | 'raw';
  iconClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
  description?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  format = 'number',
  iconClassName,
  gradientFrom = 'from-primary',
  gradientTo = 'to-primary/70',
  description,
}: MetricCardProps) {
  const displayValue =
    format === 'number' && typeof value === 'number'
      ? formatNumber(value)
      : format === 'percent' && typeof value === 'number'
      ? `${value.toFixed(2)}%`
      : String(value);

  const trendPositive = (trend ?? 0) >= 0;
  const trendZero = trend === 0 || trend === undefined;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group">
      {/* Subtle gradient glow in corner */}
      <div className={cn(
        'absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20',
        `bg-gradient-to-br ${gradientFrom} ${gradientTo}`,
      )} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">{displayValue}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
          {trend !== undefined && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                trendZero
                  ? 'bg-muted/60 text-muted-foreground'
                  : trendPositive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
              )}
            >
              {trendZero ? (
                <Minus className="h-2.5 w-2.5" />
              ) : trendPositive ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {trendZero ? 'No change' : `${Math.abs(trend).toFixed(1)}% vs last`}
            </div>
          )}
        </div>

        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
          gradientFrom,
          gradientTo,
          iconClassName,
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}
