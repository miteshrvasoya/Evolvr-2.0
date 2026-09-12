'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  db: string;
  redis: string;
  uptime: number;
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const ok = status === 'ok' || status === 'ready' || status === 'connected';
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'flex items-center gap-1 text-xs font-semibold',
        ok ? 'text-emerald-600' : 'text-red-500',
      )}>
        {ok
          ? <CheckCircle2 className="h-3.5 w-3.5" />
          : <XCircle className="h-3.5 w-3.5" />}
        {ok ? 'OK' : status}
      </span>
    </div>
  );
}

interface AgentHealthCardProps {
  /** Whether a run is currently active (to infer worker health) */
  isActive?: boolean;
  className?: string;
}

export function AgentHealthCard({ isActive, className }: AgentHealthCardProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  useEffect(() => {
    const check = async () => {
      try {
        const data = await apiClient.get<HealthData>('/api/system/health');
        setHealth(data);
        setLastChecked(new Date().toLocaleTimeString());
      } catch {
        setHealth({ status: 'error', db: 'error', redis: 'error', uptime: 0 });
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const overall = health?.status ?? 'unknown';
  const isHealthy = overall === 'ok';

  const uptime = health?.uptime
    ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
    : '—';

  return (
    <Card className={cn(
      'border',
      !health ? '' :
      isHealthy ? 'border-emerald-100' : 'border-red-200 bg-red-50/20',
      className,
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Agent Health
          </span>
          {health && (
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full border',
              isHealthy
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200',
            )}>
              {isHealthy ? '● Healthy' : '⚠ Degraded'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!health ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Services</p>
              <HealthRow label="Database (Postgres)" status={health.db} />
              <HealthRow label="Queue (Redis)" status={health.redis} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Workers</p>
              <HealthRow label="Orchestrator" status={isActive ? 'ok' : 'idle'} />
              <HealthRow label="Content Generation" status="ok" />
              <HealthRow label="Strategy" status="ok" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Server uptime</span>
              <span className="font-mono font-semibold">{uptime}</span>
            </div>
            {lastChecked && (
              <p className="text-[10px] text-muted-foreground">Last checked: {lastChecked}</p>
            )}
          </>
        )}

        {!isHealthy && health && (
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              System degraded
            </p>
            <p className="text-xs text-red-600 mt-1">
              {health.db !== 'ok' && 'Database is unavailable. '}
              {health.redis !== 'ok' && 'Queue (Redis) is unavailable. Job processing is paused.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
