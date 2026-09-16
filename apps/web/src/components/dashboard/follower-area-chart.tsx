'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { AccountMetrics } from '@evolvr/types';
import { formatNumber } from '@/lib/utils';

interface FollowerAreaChartProps {
  data: AccountMetrics[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-semibold text-foreground">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FollowerAreaChart({ data }: FollowerAreaChartProps) {
  const chartData = data.map((m) => ({
    date: new Date(m.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Followers: m.followers ?? 0,
    Reach: m.reach ?? 0,
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            tickFormatter={(v: number) => formatNumber(v)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Area
            type="monotone"
            dataKey="Followers"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            fill="url(#followersGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--primary))' }}
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="Reach"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#reachGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#a855f7' }}
            strokeDasharray="5 3"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
