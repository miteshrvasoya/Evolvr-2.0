'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePrompts, PromptDto } from '@/lib/hooks/use-prompts';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw, Copy, Check, Sparkles, ImagePlus, ExternalLink, Bot,
  CheckCircle2, XCircle, Zap, Filter, Search, Library, Clock, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';

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
  onRefresh,
}: {
  prompt: PromptDto;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(prompt.mediaStatus !== 'READY');
  const [showUploader, setShowUploader] = useState(false);

  const sourceConfig = {
    ai_generated: { label: 'AI Generated', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    user_edited:  { label: 'User Edited',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    improved:     { label: 'AI Improved',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const src = sourceConfig[prompt.source as keyof typeof sourceConfig] ?? sourceConfig.ai_generated;
  const assetTypeLabel = prompt.assetType === 'video_placeholder' ? 'Video' : 'Image';
  const isNeedsMedia = prompt.mediaStatus === 'FAILED' || prompt.mediaStatus === 'PENDING';

  return (
    <div className={cn(
      'rounded-xl border transition-all overflow-hidden',
      isNeedsMedia ? 'border-orange-200 bg-orange-50/10 dark:border-orange-800/50' : 'border-border bg-card',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate flex items-center gap-2">
            {prompt.concept}
            {isNeedsMedia && <Badge variant="destructive" className="h-4 text-[9px] px-1.5 py-0">Needs Media</Badge>}
            {!isNeedsMedia && <Badge variant="success" className="h-4 text-[9px] px-1.5 py-0">Media Ready</Badge>}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold text-muted-foreground capitalize">{assetTypeLabel} Prompt v{prompt.promptVersion}</span>
            <span className="text-muted-foreground/30">·</span>
            <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', src.cls)}>{src.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words select-all">
            {prompt.promptText}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-700 p-2.5 text-[11px]">
            <Zap className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-600 dark:text-zinc-400">
              Copy this prompt → generate manually using your preferred tool → upload the result.
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <CopyBtn text={prompt.promptText} label="Copy Prompt" />
            <Button
              variant={showUploader ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowUploader(!showUploader)}
              className="h-7 text-xs px-2.5 py-1"
            >
              {showUploader ? 'Cancel Upload' : 'Upload Media'}
            </Button>
            <Link
              href={`/dashboard/content/${prompt.contentIdeaId}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors h-7"
            >
              <ExternalLink className="h-3 w-3" />
              Content Detail
            </Link>
          </div>

          {showUploader && (
            <div className="mt-4 animate-in slide-in-from-top-2">
              <MediaUploader
                contentIdeaId={prompt.contentIdeaId}
                mediaRequirement={{ id: prompt.mediaRequirementId, mediaType: prompt.assetType } as any}
                onUploadComplete={() => {
                  setShowUploader(false);
                  onRefresh();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PromptLibraryPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { prompts, isLoading, refresh } = usePrompts(statusFilter, typeFilter);

  const filteredPrompts = prompts.filter(p => 
    !search || [p.promptText, p.concept].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6 text-purple-500" />
            Prompt & Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access all your generated prompts, copy them for external tools, and upload media to fulfill requirements.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search prompts or concepts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {[
            { value: '', label: 'All Status' },
            { value: 'needs_media', label: 'Needs Media' },
            { value: 'ready', label: 'Ready' }
          ].map(f => (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-border mx-1">|</span>
          {[
            { value: '', label: 'All Types' },
            { value: 'image', label: 'Images' },
            { value: 'video_placeholder', label: 'Videos' }
          ].map(f => (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                typeFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card py-20 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-400/50 mx-auto" />
          <p className="text-base font-semibold text-muted-foreground">No prompts found</p>
          <p className="text-sm text-muted-foreground/60">
            {statusFilter === 'needs_media' ? 'All media is fully generated and ready!' : 'Try adjusting your search filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
