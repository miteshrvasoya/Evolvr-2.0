import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number; // positive = up, negative = down
  format?: 'number' | 'percent' | 'raw';
  iconClassName?: string;
}

export function MetricCard({ label, value, icon: Icon, trend, format = 'number', iconClassName }: MetricCardProps) {
  const displayValue =
    format === 'number' && typeof value === 'number'
      ? formatNumber(value)
      : format === 'percent' && typeof value === 'number'
      ? `${(value * 100).toFixed(1)}%`
      : String(value);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{displayValue}</p>
            {trend !== undefined && (
              <div
                className={cn(
                  'mt-1 flex items-center gap-1 text-xs font-medium',
                  trend >= 0 ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend).toFixed(1)}% vs last period
              </div>
            )}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-primary/10', iconClassName)}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
