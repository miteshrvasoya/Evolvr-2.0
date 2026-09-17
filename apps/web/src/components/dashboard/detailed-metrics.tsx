'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Eye, Heart, MessageCircle, Share2, Bookmark, MessageSquare,
  Repeat2, Users, Zap, MousePointerClick, UserPlus, UserMinus, Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatNumber } from '@/lib/utils';
import type { AccountMetricsRow } from '@/lib/hooks/use-dashboard';

interface DetailedMetricsProps {
  history: AccountMetricsRow[];
}

const METRICS_CONFIG = [
  { key: 'followers', label: 'Followers', icon: Users, color: 'hsl(var(--primary))' },
  { key: 'reach', label: 'Reach', icon: Radio, color: '#a855f7' },
  { key: 'views', label: 'Views', icon: Eye, color: '#2563eb' },
  { key: 'accountsEngaged', label: 'Accounts Engaged', icon: Users, color: '#4f46e5' },
  { key: 'likes', label: 'Likes', icon: Heart, color: '#e11d48' },
  { key: 'comments', label: 'Comments', icon: MessageCircle, color: '#d97706' },
  { key: 'shares', label: 'Shares', icon: Share2, color: '#0891b2' },
  { key: 'saves', label: 'Saves', icon: Bookmark, color: '#7c3aed' },
  { key: 'replies', label: 'Replies', icon: MessageSquare, color: '#0d9488' },
  { key: 'reposts', label: 'Reposts', icon: Repeat2, color: '#ea580c' },
  { key: 'totalInteractions', label: 'Interactions', icon: Zap, color: '#ca8a04' },
  { key: 'profileLinksTaps', label: 'Link Taps', icon: MousePointerClick, color: '#db2777' },
];

export function DetailedMetrics({ history }: DetailedMetricsProps) {
  const [timeRange, setTimeRange] = useState<number>(7);
  const [selectedMetric, setSelectedMetric] = useState<string>('followers');

  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice(Math.max(history.length - timeRange, 0));
  }, [history, timeRange]);

  const chartData = useMemo(() => {
    return filteredHistory.map((m) => {
      const dateVal = (m.capturedAt as string) || (m.captured_at as string);
      return {
        date: new Date(dateVal).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: (m[selectedMetric] as number) ?? 0,
      };
    });
  }, [filteredHistory, selectedMetric]);

  const activeConfig = METRICS_CONFIG.find(c => c.key === selectedMetric) as typeof METRICS_CONFIG[0];
  const latestMetrics = (filteredHistory[filteredHistory.length - 1] || {}) as Partial<AccountMetricsRow>;

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
        <div>
          <CardTitle className="text-lg font-bold">Performance Analytics</CardTitle>
          <CardDescription>Select a metric below to visualize its growth over time</CardDescription>
        </div>
        <Tabs value={timeRange.toString()} onValueChange={(v) => setTimeRange(Number(v))}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="30">30 Days</TabsTrigger>
            <TabsTrigger value="90">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        {/* Main Chart */}
        <div className="h-[300px] w-full mb-8">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No historical data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false} tickLine={false} dy={10} 
                />
                <YAxis 
                  tickFormatter={(v) => formatNumber(v)}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg text-xs">
                        <p className="font-semibold text-foreground mb-1">{label}</p>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: activeConfig.color }} />
                          <span className="text-muted-foreground">{activeConfig.label}:</span>
                          <span className="font-semibold text-foreground">{formatNumber((payload?.[0]?.value as number) ?? 0)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={activeConfig.color}
                  strokeWidth={3}
                  fill="url(#metricGradient)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: activeConfig.color }}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {METRICS_CONFIG.map((config) => {
            const Icon = config.icon;
            const isSelected = selectedMetric === config.key;
            // The DB might return camelCase or snake_case depending on how postgres.js maps it
            const value = (latestMetrics[config.key] as number) 
              || (latestMetrics[config.key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] as number) 
              || 0;
            
            return (
              <button
                key={config.key}
                onClick={() => setSelectedMetric(config.key)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:bg-muted/50",
                  isSelected 
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" 
                    : "border-border bg-card"
                )}
              >
                <div className="flex w-full items-center justify-between mb-2">
                  <div 
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {config.label}
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {formatNumber(value)}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
