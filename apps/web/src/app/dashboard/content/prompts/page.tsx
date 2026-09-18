'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUngeneratedPrompts, type AgentRunGroup, type UngeneratedIdea, type UngeneratedPrompt } from '@/lib/hooks/use-ungenerated-prompts';
import { useAssetActions } from '@/lib/hooks/use-asset-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw, AlertTriangle, Copy, Check, Sparkles, Loader2, Upload,
  ChevronDown, ChevronRight, ImagePlus, ExternalLink, Bot, Clock,
  CheckCircle2, XCircle, Zap, Filter, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Input } from '@/components/ui/input';

// ── Error labels ──────────────────────────────────────────────────────────────
const ERROR_LABELS: Record<string, string> = {
  timeout:        'Timeout',
  rate_limited:   'Rate Limited',
  provider_error: 'Provider Error',
  content_policy: 'Content Policy',
  invalid_prompt: 'Invalid Prompt',
  quota_exceeded: 'Quota Exceeded',
  permanent:      'Permanent Failure',
  transient:      'Transient Error',
};

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reel', carousel: 'Carousel', static_post: 'Post', story: 'Story',
};

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-border bg-background hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ── Prompt Card ───────────────────────────────────────────────────────────────
function PromptCard({
  prompt,
  ideaId,
  isLatest,
  onRefresh,
}: {
  prompt: UngeneratedPrompt;
  ideaId: string;
  isLatest: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(isLatest);
  const { isImproving, improvePrompt, isRetrying, retryAsset } = useAssetActions(ideaId, onRefresh);

  const sourceConfig = {
    ai_generated: { label: 'AI Generated', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    user_edited:  { label: 'User Edited',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    improved:     { label: 'AI Improved',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const src = sourceConfig[prompt.source] ?? sourceConfig.ai_generated;
  const assetTypeLabel = prompt.assetType === 'video_placeholder' ? 'Video' : 'Image';

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      isLatest ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : 'bg-muted/10',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-semibold">{assetTypeLabel} Prompt v{prompt.promptVersion}</span>
        {isLatest && <Badge className="text-[9px] px-1.5 py-0 h-4">Latest</Badge>}
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', src.cls)}>{src.label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* The prompt text */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words select-all">
            {prompt.promptText}
          </div>

          {/* Callout */}
          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-700 p-2.5 text-[11px]">
            <Zap className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-600 dark:text-zinc-400">
              Copy this prompt → paste into Midjourney, DALL·E, or Stable Diffusion → upload the result on the content detail page.
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <CopyBtn text={prompt.promptText} label="Copy Prompt" />
            {isLatest && (
              <>
                <button
                  onClick={async () => {
                    try {
                      await retryAsset(prompt.assetType);
                      toast({ title: 'Retry queued', description: 'Generation retry started.' });
                      onRefresh();
                    } catch { toast({ variant: 'destructive', title: 'Retry failed' }); }
                  }}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Retry Generation
                </button>
                <button
                  onClick={async () => {
                    try {
                      await improvePrompt(prompt.assetType);
                      toast({ title: 'Prompt improved', description: 'New AI-improved version saved.' });
                      onRefresh();
                    } catch { toast({ variant: 'destructive', title: 'Failed to improve' }); }
                  }}
                  disabled={isImproving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 text-purple-700 px-2.5 py-1 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                >
                  {isImproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Improve
                </button>
                <Link
                  href={`/dashboard/content/${ideaId}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Detail
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Content Idea Row ──────────────────────────────────────────────────────────
function IdeaRow({
  idea,
  onRefresh,
  searchQuery,
}: {
  idea: UngeneratedIdea;
  onRefresh: () => void;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(idea.needsAttention);

  // Filter by search
  const matchesSearch = !searchQuery || [idea.hook, idea.concept, idea.caption, idea.format, idea.pillar]
    .some(v => v?.toLowerCase().includes(searchQuery.toLowerCase()));
  if (!matchesSearch) return null;

  // Group prompts by assetType (keep only latest per type by default)
  const prompts = idea.prompts || [];
  const promptsByType = prompts.reduce<Record<string, UngeneratedPrompt[]>>((acc, p) => {
    const key = p.assetType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const isFailed = idea.assetGenerationStatus === 'needs_attention';

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all',
      isFailed ? 'border-orange-200 dark:border-orange-800' : 'border-border',
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{idea.hook || idea.concept}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground capitalize">{FORMAT_LABELS[idea.format] || idea.format}</span>
            {idea.pillar && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground capitalize">{idea.pillar?.replace(/_/g, ' ')}</span>
              </>
            )}
            {isFailed && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] font-semibold text-orange-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Generation Failed
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
            {prompts.length} prompt{prompts.length !== 1 ? 's' : ''}
          </span>
          {idea.lastFailure?.errorCategory && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
              {ERROR_LABELS[idea.lastFailure.errorCategory] || idea.lastFailure.errorCategory}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Failure alert */}
          {idea.needsAttention && (idea.lastFailure || idea.needsAttentionReason) && (
            <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 p-3 text-xs space-y-0.5">
              {idea.lastFailure && (
                <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  {ERROR_LABELS[idea.lastFailure.errorCategory] || idea.lastFailure.errorCategory}
                  {idea.lastFailure.attemptNumber > 1 && ` · ${idea.lastFailure.attemptNumber} attempts`}
                </p>
              )}
              {!idea.lastFailure && idea.needsAttentionReason && (
                <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Needs Attention
                </p>
              )}
              <p className="text-red-600/80 dark:text-red-400/80 ml-5">
                {idea.lastFailure?.errorMessage || idea.needsAttentionReason}
              </p>
            </div>
          )}

          {/* Content preview */}
          {idea.caption && (
            <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1.5">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Caption</p>
              <p className="text-sm leading-relaxed line-clamp-3">{idea.caption}</p>
              <CopyBtn text={idea.caption} label="Copy Caption" />
            </div>
          )}

          {/* Prompts grouped by asset type */}
          {Object.entries(promptsByType).map(([assetType, typePrompts]) => {
            const sorted = [...typePrompts].sort((a, b) => b.promptVersion - a.promptVersion);
            return (
              <div key={assetType} className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {assetType === 'video_placeholder' ? '📹 Video Prompts' : '🖼️ Image Prompts'}
                  <span className="ml-1.5 text-muted-foreground/60 font-normal normal-case tracking-normal">
                    ({sorted.length} version{sorted.length !== 1 ? 's' : ''})
                  </span>
                </h4>
                <div className="space-y-1.5">
                  {sorted.map((p, i) => (
                    <PromptCard
                      key={p.id}
                      prompt={p}
                      ideaId={idea.id}
                      isLatest={i === 0}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Agent Run Group ───────────────────────────────────────────────────────────
function RunGroup({
  group,
  onRefresh,
  searchQuery,
  defaultExpanded,
}: {
  group: AgentRunGroup;
  onRefresh: () => void;
  searchQuery: string;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { run, ideas } = group;

  const isLinked = run.id !== 'unlinked';
  const failedCount = ideas.filter(i => i.needsAttention).length;
  const totalPrompts = ideas.reduce((sum, i) => sum + (i.prompts?.length ?? 0), 0);

  const runStatusIcon = {
    completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    failed:    <XCircle className="h-4 w-4 text-red-500" />,
    running:   <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    unknown:   <Bot className="h-4 w-4 text-muted-foreground" />,
  }[run.status] ?? <Bot className="h-4 w-4 text-muted-foreground" />;

  // Visible ideas count accounting for search filter
  const visibleIdeas = ideas.filter(idea =>
    !searchQuery || [idea.hook, idea.concept, idea.caption, idea.format, idea.pillar]
      .some(v => v?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  if (visibleIdeas.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card/50 overflow-hidden">
      {/* Run header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        {runStatusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">
              {isLinked ? `Agent Run` : 'Unlinked Content'}
            </span>
            {run.strategyVersionNumber && (
              <Badge variant="outline" className="text-[10px]">Strategy v{run.strategyVersionNumber}</Badge>
            )}
            {run.status !== 'unknown' && (
              <Badge
                variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'destructive' : 'secondary'}
                className="text-[10px] capitalize"
              >
                {run.status}
              </Badge>
            )}
          </div>
          {run.startedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(run.startedAt), 'MMM d, yyyy · HH:mm')}
              {' — '}
              {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {failedCount} failed
            </span>
          )}
          <div className="text-right">
            <p className="text-sm font-bold">{ideas.length}</p>
            <p className="text-[10px] text-muted-foreground">content item{ideas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{totalPrompts}</p>
            <p className="text-[10px] text-muted-foreground">prompt{totalPrompts !== 1 ? 's' : ''}</p>
          </div>
          {isLinked && (
            <Link
              href={`/dashboard/agent/runs/${run.id}`}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2 py-1"
            >
              <ExternalLink className="h-3 w-3" />
              Run
            </Link>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Ideas list */}
      {expanded && (
        <div className="border-t bg-background/50 px-4 py-4 space-y-3">
          {ideas.map(idea => (
            <IdeaRow key={idea.id} idea={idea} onRefresh={onRefresh} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UngeneratedPromptsPage() {
  const { groups, totalIdeas, totalPrompts, isLoading, refresh } = useUngeneratedPrompts();
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const filteredGroups = formatFilter
    ? groups.map(g => ({
        ...g,
        ideas: g.ideas.filter(i => i.format === formatFilter),
      })).filter(g => g.ideas.length > 0)
    : groups;

  const allFormats = Array.from(new Set(groups.flatMap(g => g.ideas.map(i => i.format)))).filter(Boolean);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImagePlus className="h-6 w-6 text-orange-500" />
            Ungenerated Media Prompts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All AI-generated prompts where media content hasn't been successfully created yet — grouped by Agent Run.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats bar */}
      {totalIdeas > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Agent Runs', value: groups.length, icon: Bot, cls: 'text-blue-500' },
            { label: 'Content Items', value: totalIdeas, icon: ImagePlus, cls: 'text-orange-500' },
            { label: 'Total Prompts', value: totalPrompts, icon: Sparkles, cls: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="rounded-xl border bg-card px-5 py-4 flex items-center gap-4">
              <div className={cn('h-9 w-9 rounded-full bg-current/10 flex items-center justify-center', cls)}>
                <Icon className={cn('h-4.5 w-4.5', cls)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {totalIdeas > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by hook, concept, caption…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {['', ...allFormats].map(f => (
              <button
                key={f}
                onClick={() => setFormatFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors capitalize',
                  formatFilter === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {f || 'All Formats'}{' '}
                {!f && totalIdeas > 0 && (
                  <span className="opacity-60">({totalIdeas})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredGroups.length === 0 && !isLoading && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card py-20 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-400/50 mx-auto" />
          <p className="text-base font-semibold text-muted-foreground">All prompts have media!</p>
          <p className="text-sm text-muted-foreground/60">
            Every AI-generated prompt has a successfully generated media asset.
          </p>
        </div>
      )}

      {/* Groups */}
      <div className="space-y-4">
        {filteredGroups.map((group, i) => (
          <RunGroup
            key={group.run.id}
            group={group}
            onRefresh={refresh}
            searchQuery={search}
            defaultExpanded={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
