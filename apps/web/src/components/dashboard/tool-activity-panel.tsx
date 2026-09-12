'use client';

import { Wrench, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ToolCall {
  id: string;
  name: string;
  status: 'success' | 'failed' | 'running' | 'retrying';
  latencyMs?: number;
  detail?: string;
  attempt?: number;
  maxAttempts?: number;
  createdAt: string;
}

function toolName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
    return `${host}/${path}`;
  } catch {
    return url;
  }
}

interface ToolActivityPanelProps {
  apiLogs: Array<{
    method: string;
    url: string;
    statusCode: number;
    latencyMs: number;
    createdAt: string;
  }>;
  className?: string;
}

export function ToolActivityPanel({ apiLogs, className }: ToolActivityPanelProps) {
  // Only show external API calls (not internal)
  const external = apiLogs
    .filter(l => !l.url.includes('127.0.0.1') && !l.url.includes('localhost'))
    .slice(0, 20);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-blue-500" />
          Tool / API Calls
          {external.length > 0 && (
            <span className="ml-auto text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-semibold">
              {external.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {external.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Wrench className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground">No external API calls logged</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y">
            {external.map((log, i) => {
              const ok = log.statusCode < 400;
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 text-xs">
                  {ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    : <XCircle      className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono truncate text-foreground/80" title={log.url}>
                      {toolName(log.url)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {log.method} · {log.statusCode} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={cn(
                    'tabular-nums font-mono text-[11px] flex-shrink-0',
                    log.latencyMs > 2000 ? 'text-orange-500' :
                    log.latencyMs > 1000 ? 'text-amber-500'  : 'text-muted-foreground',
                  )}>
                    {log.latencyMs >= 1000
                      ? `${(log.latencyMs / 1000).toFixed(1)}s`
                      : `${log.latencyMs}ms`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
