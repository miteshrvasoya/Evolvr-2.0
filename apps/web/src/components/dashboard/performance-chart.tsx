'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPercent } from '@/lib/utils';

interface PerformanceDataPoint {
  name: string;
  avgEngagementRate: number;
  avgReach: number;
  count: number;
}

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
  metric?: 'engagementRate' | 'reach';
}

export function PerformanceChart({ data, metric = 'engagementRate' }: PerformanceChartProps) {
  const chartData = data.map((d) => ({
    name: d.name,
    value: metric === 'engagementRate' ? d.avgEngagementRate * 100 : d.avgReach,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) =>
            metric === 'engagementRate' ? `${v.toFixed(1)}%` : String(Math.round(v))
          }
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) =>
            metric === 'engagementRate' ? [`${value.toFixed(2)}%`, 'Avg Engagement'] : [value, 'Avg Reach']
          }
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
