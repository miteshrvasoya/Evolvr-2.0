'use client';

import { Brain, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { AgentEventItem } from '@/lib/hooks/use-agent-events';

interface LLMCall {
  id: string;
  task: string;
  model?: string;
  status: 'success' | 'failed' | 'running';
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
  createdAt: string;
}

function parseLLMEvents(events: AgentEventItem[]): LLMCall[] {
  const calls: LLMCall[] = [];
  for (const evt of events) {
    const t = evt.eventType.toLowerCase();
    const meta = evt.metadata ?? {};
    if (t.includes('llm') || t.includes('openrouter') || t.includes('model') || t.includes('strategy_generation') || t.includes('content_generation')) {
      calls.push({
        id: evt.id,
        task: (meta.task as string) ?? evt.eventType.replace(/_/g, ' '),
        model: (meta.model as string) ?? (meta.modelId as string) ?? undefined,
        status: evt.level === 'error' ? 'failed' : t.includes('start') ? 'running' : 'success',
        latencyMs: meta.latencyMs as number | undefined,
        inputTokens: (meta.inputTokens ?? meta.promptTokens) as number | undefined,
        outputTokens: (meta.outputTokens ?? meta.completionTokens) as number | undefined,
        attempt: meta.attempt as number | undefined,
        maxAttempts: meta.maxAttempts as number | undefined,
        error: evt.level === 'error' ? evt.message : undefined,
        createdAt: evt.createdAt,
      });
    }
  }
  return calls.slice(-10).reverse();
}

function LLMRow({ call }: { call: LLMCall }) {
  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {call.status === 'running'  && <Loader2      className="h-4 w-4 text-purple-500 animate-spin" />}
        {call.status === 'success'  && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {call.status === 'failed'   && <XCircle      className="h-4 w-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold capitalize">{call.task.replace(/_/g, ' ')}</span>
          {call.model && (
            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.5 font-mono">
              {call.model.split('/').pop()}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {call.latencyMs != null && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(call.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {call.inputTokens != null && (
            <span className="text-[10px] text-muted-foreground">
              {call.inputTokens.toLocaleString()} in
            </span>
          )}
          {call.outputTokens != null && (
            <span className="text-[10px] text-muted-foreground">
              {call.outputTokens.toLocaleString()} out
            </span>
          )}
          {call.attempt != null && call.maxAttempts != null && call.attempt > 1 && (
            <span className="text-[10px] text-orange-600 font-semibold">
              Attempt {call.attempt}/{call.maxAttempts}
            </span>
          )}
        </div>
        {call.error && (
          <p className="text-[11px] text-red-500 mt-1 font-mono truncate">{call.error}</p>
        )}
      </div>
    </div>
  );
}

interface LLMActivityPanelProps {
  /** SSE events from useAgentEvents */
  events: AgentEventItem[];
  /** Fallback: raw api logs from /agent/status */
  apiLogs?: Array<{ method: string; url: string; statusCode: number; latencyMs: number; createdAt: string }>;
  className?: string;
}

export function LLMActivityPanel({ events, apiLogs = [], className }: LLMActivityPanelProps) {
  const llmCalls = parseLLMEvents(events);

  // If no parsed LLM events, fall back to outward API logs filtered for LLM providers
  const fallbackLogs = llmCalls.length === 0
    ? apiLogs.filter(l => l.url.includes('openrouter') || l.url.includes('openai') || l.url.includes('anthropic') || l.url.includes('gemini'))
    : [];

  const hasData = llmCalls.length > 0 || fallbackLogs.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          LLM Activity
          {llmCalls.length > 0 && (
            <span className="ml-auto text-[10px] bg-purple-50 text-purple-600 border border-purple-100 rounded-full px-2 py-0.5 font-semibold">
              {llmCalls.length} calls
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Brain className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground">No LLM calls logged yet</p>
          </div>
        ) : llmCalls.length > 0 ? (
          <div>
            {llmCalls.map(c => <LLMRow key={c.id} call={c} />)}
          </div>
        ) : (
          /* Fallback: raw API log table */
          <div className="space-y-2">
            {fallbackLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 text-xs">
                <span className={cn(
                  'font-semibold',
                  log.statusCode >= 400 ? 'text-red-500' : 'text-emerald-500',
                )}>
                  {log.statusCode}
                </span>
                <span className="text-muted-foreground truncate flex-1" title={log.url}>
                  {log.url.replace(/https?:\/\/[^/]+/, '')}
                </span>
                <span className="text-amber-600 tabular-nums">{log.latencyMs}ms</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
