'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useContentDetail, useGenerationHistory, type ContentPrompt } from '@/lib/hooks/use-content-detail';
import { useAssetActions } from '@/lib/hooks/use-asset-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  ImagePlus, Sparkles, Copy, Check, Upload, Loader2, XCircle,
  History, ChevronDown, ChevronRight, Pencil, Zap, ExternalLink,
  Eye, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'outline' }> = {
  draft:            { label: 'Draft',           variant: 'secondary'   },
  waiting_approval: { label: 'Awaiting Review', variant: 'outline'     },
  ready:            { label: 'Ready',           variant: 'success'     },
  blocked:          { label: 'Blocked',         variant: 'destructive' },
};

const ASSET_STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  completed:       { label: 'Assets Ready',   icon: CheckCircle2,  cls: 'text-emerald-500' },
  needs_attention: { label: 'Needs Attention',icon: AlertTriangle, cls: 'text-orange-500'  },
  pending:         { label: 'Generating',     icon: Clock,         cls: 'text-amber-500'   },
  generating:      { label: 'Generating',     icon: Clock,         cls: 'text-amber-500'   },
  none:            { label: 'No Assets',      icon: ImagePlus,     cls: 'text-muted-foreground' },
};

const ERROR_LABELS: Record<string, { label: string; tip: string }> = {
  timeout:        { label: 'Timeout',          tip: 'Provider took too long. Copy the prompt and try another tool.' },
  rate_limited:   { label: 'Rate Limited',     tip: 'Wait a few minutes and retry generation.' },
  provider_error: { label: 'Provider Error',   tip: 'Internal provider failure. Retry or use the prompt below manually.' },
  content_policy: { label: 'Content Policy',   tip: 'Prompt was rejected. Use "Improve Prompt" to refine it.' },
  invalid_prompt: { label: 'Invalid Prompt',   tip: 'Prompt format rejected. Edit or improve it below.' },
  quota_exceeded: { label: 'Quota Exceeded',   tip: 'Provider quota exhausted. Copy the prompt to use another tool.' },
  permanent:      { label: 'Permanent Error',  tip: 'Cannot auto-retry. Copy the prompt below for manual generation.' },
  transient:      { label: 'Transient Error',  tip: 'Temporary error. Retry is likely to succeed.' },
};

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-8">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
}

// ── Prominent Prompt Card ─────────────────────────────────────────────────────
function PromptCard({
  prompt,
  isCurrent,
  ideaId,
  onRefresh,
  hasFailed,
}: {
  prompt: ContentPrompt;
  isCurrent: boolean;
  ideaId: string;
  onRefresh: () => void;
  hasFailed: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.promptText);
  const [saving, setSaving] = useState(false);
  const { editPrompt, isImproving, improvePrompt } = useAssetActions(ideaId, onRefresh);

  const sourceColors = {
    ai_generated: 'text-purple-600 bg-purple-50 border-purple-200',
    user_edited:  'text-blue-600 bg-blue-50 border-blue-200',
    improved:     'text-emerald-600 bg-emerald-50 border-emerald-200',
  } as const;
  const sourceLabel = { ai_generated: 'AI Generated', user_edited: 'User Edited', improved: 'AI Improved' } as const;
  const srcColor = sourceColors[prompt.source as keyof typeof sourceColors] ?? sourceColors.ai_generated;
  const srcLabel = sourceLabel[prompt.source as keyof typeof sourceLabel] ?? 'Generated';

  async function handleSave() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await editPrompt(prompt.id, editText);
      toast({ title: 'Prompt saved', description: 'New user-edited version created.' });
      setEditing(false);
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save' });
    } finally { setSaving(false); }
  }

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isCurrent && hasFailed ? 'border-orange-200 bg-orange-50/40 dark:border-orange-800 dark:bg-orange-950/20' : '',
      isCurrent && !hasFailed ? 'border-primary/20 bg-primary/5' : '',
      !isCurrent ? 'bg-muted/20' : '',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-semibold">Prompt v{prompt.promptVersion}</span>
          {isCurrent && <Badge className="text-[10px] px-1.5 py-0 h-4">Current</Badge>}
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize', srcColor)}>{srcLabel}</span>
          <span className="text-[10px] capitalize text-muted-foreground">{prompt.assetType.replace('_', ' ')}</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-xs font-mono rounded-lg border bg-background p-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1">
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save as New Version
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(prompt.promptText); }} className="h-8 text-xs">
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Original prompt is always preserved.</p>
            </div>
          ) : (
            <>
              {/* The prompt text — prominent + easy to read */}
              <div className={cn(
                'rounded-lg p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words border',
                hasFailed && isCurrent
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                  : 'bg-muted/40 border-border',
              )}>
                {prompt.promptText}
              </div>

              {hasFailed && isCurrent && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs space-y-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Ready to use manually
                  </p>
                  <p className="text-amber-700 dark:text-amber-500">
                    Copy this prompt and paste it into Midjourney, DALL·E, Stable Diffusion, or any other image tool, then upload the result.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <CopyButton text={prompt.promptText} label="Copy Prompt" />
                {isCurrent && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try {
                          await improvePrompt(prompt.assetType);
                          toast({ title: 'Prompt improved', description: 'New version saved.' });
                          onRefresh();
                        } catch { toast({ variant: 'destructive', title: 'Failed to improve' }); }
                      }}
                      disabled={isImproving}
                      className="h-8 text-xs gap-1 text-purple-600 hover:text-purple-700"
                    >
                      {isImproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Improve
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Asset Panel ───────────────────────────────────────────────────────────────
function AssetPanel({
  ideaId,
  assets,
  prompts,
  onRefresh,
}: {
  ideaId: string;
  assets: any[];
  prompts: ContentPrompt[];
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const { isRetrying, retryAsset, uploadAsset } = useAssetActions(ideaId, onRefresh);

  const imageAsset = assets.find(a => a.assetType === 'image');
  const imagePrompts = prompts.filter(p => p.assetType === 'image').sort((a, b) => b.promptVersion - a.promptVersion);
  const videoPrompts = prompts.filter(p => p.assetType === 'video_placeholder').sort((a, b) => b.promptVersion - a.promptVersion);

  const isFailed = imageAsset?.generationStatus === 'failed' || (imagePrompts.length > 0 && !imageAsset);
  const errorInfo = imageAsset?.errorCategory ? ERROR_LABELS[imageAsset.errorCategory] : null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAsset(file);
      toast({ title: 'Asset uploaded', description: 'Image attached.' });
      onRefresh();
    } catch { toast({ variant: 'destructive', title: 'Upload failed' }); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-6">
      {/* Image asset */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ImagePlus className="h-4 w-4" />
            Image
            {imageAsset?.generationStatus && (
              <Badge
                variant={imageAsset.generationStatus === 'generated' ? 'success' : 'destructive'}
                className="text-[10px]"
              >
                {imageAsset.generationStatus.replace('_', ' ')}
              </Badge>
            )}
          </h3>
          <div className="flex gap-2">
            {(isFailed || !imageAsset) && imagePrompts.length > 0 && (
              <Button
                size="sm" variant="outline"
                onClick={() => retryAsset('image')}
                disabled={isRetrying}
                className="h-8 text-xs gap-1"
              >
                {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Retry
              </Button>
            )}
            <label className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs rounded-md border cursor-pointer hover:bg-accent transition-colors',
              uploading && 'opacity-50 pointer-events-none',
            )}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Upload Image'}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Image preview or placeholder */}
        {imageAsset?.storageUrl ? (
          <div className="relative rounded-xl overflow-hidden border bg-muted aspect-video max-w-sm">
            <img src={imageAsset.storageUrl} alt="Generated" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 aspect-video max-w-sm flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <ImagePlus className="h-8 w-8" />
            <span className="text-xs">No image yet</span>
          </div>
        )}

        {/* Error detail */}
        {imageAsset?.errorCategory && (
          <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                {errorInfo?.label || imageAsset.errorCategory}
              </p>
            </div>
            {imageAsset.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-500 ml-6 font-mono">{imageAsset.errorMessage}</p>
            )}
            {errorInfo?.tip && (
              <p className="text-xs text-amber-600 dark:text-amber-400 ml-6">→ {errorInfo.tip}</p>
            )}
          </div>
        )}

        {/* Image prompts */}
        {imagePrompts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image Prompts</h4>
            {imagePrompts.map((p, i) => (
              <PromptCard key={p.id} prompt={p} isCurrent={i === 0} ideaId={ideaId} onRefresh={onRefresh} hasFailed={isFailed} />
            ))}
          </div>
        )}
      </div>

      {/* Video prompts (if any) */}
      {videoPrompts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Video Prompts</h4>
          {videoPrompts.map((p, i) => (
            <PromptCard key={p.id} prompt={p} isCurrent={i === 0} ideaId={ideaId} onRefresh={onRefresh} hasFailed={false} />
          ))}
        </div>
      )}

      {imagePrompts.length === 0 && videoPrompts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No AI prompts yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Prompts are generated automatically when the agent creates content.</p>
        </div>
      )}
    </div>
  );
}

// ── Generation History ─────────────────────────────────────────────────────────
function GenerationHistorySection({ attempts }: { attempts: any[] }) {
  if (!attempts.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <History className="h-4 w-4" />
        Generation History
        <span className="text-xs font-normal text-muted-foreground">({attempts.length} attempt{attempts.length !== 1 ? 's' : ''})</span>
      </h3>
      <div className="space-y-2">
        {attempts.map((a, i) => (
          <div key={a.id} className={cn(
            'rounded-lg border p-3 space-y-2 text-xs',
            a.status === 'failed' ? 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20' :
            a.status === 'generated' ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800' :
            'bg-muted/20',
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {a.status === 'failed' ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                ) : a.status === 'generated' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className="font-semibold capitalize">{a.assetType?.replace('_', ' ')} • Attempt #{a.attemptNumber}</span>
                {i === 0 && <Badge className="text-[9px] py-0 px-1 h-3.5">Latest</Badge>}
              </div>
              <span className="text-muted-foreground">
                {a.completedAt ? format(new Date(a.completedAt), 'MMM d, HH:mm') : 'In progress'}
              </span>
            </div>
            {a.errorMessage && (
              <p className="text-red-600 dark:text-red-400 font-mono ml-5">{a.errorMessage}</p>
            )}
            {a.promptText && (
              <div className="ml-5 space-y-1">
                <span className="text-muted-foreground uppercase tracking-wider text-[9px] font-semibold">Prompt used</span>
                <p className="font-mono bg-muted/40 rounded p-1.5 text-[10px] line-clamp-2">{a.promptText}</p>
              </div>
            )}
            {a.durationMs && (
              <p className="text-muted-foreground ml-5">Duration: {(a.durationMs / 1000).toFixed(1)}s</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { content, isLoading, refresh } = useContentDetail(id);
  const { attempts, refresh: refreshHistory } = useGenerationHistory(id);
  const [activeSection, setActiveSection] = useState<'overview' | 'media' | 'history' | 'versions'>('media');

  function handleRefresh() {
    refresh();
    refreshHistory();
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-5xl py-16 text-center space-y-3">
        <p className="text-muted-foreground">Content not found</p>
        <Link href="/dashboard/content">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[content.status] || { label: content.status, variant: 'secondary' as const };
  const assetConf = ASSET_STATUS_CONFIG[content.assetGenerationStatus] ?? ASSET_STATUS_CONFIG['none']!;
  const AssetIcon = assetConf.icon;
  const hashtags = Array.isArray(content.hashtags) ? content.hashtags : [];
  const hasFailed = content.assetGenerationStatus === 'needs_attention';
  const hasPrompts = (content.prompts?.length ?? 0) > 0;

  return (
    <div className="max-w-5xl space-y-6 pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/dashboard/content"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Content Library
        </Link>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Needs Attention Hero Banner ── */}
      {hasFailed && (
        <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 dark:border-orange-700 p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-orange-800 dark:text-orange-300">Media Generation Failed</h2>
              {content.needsAttentionReason && (
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">{content.needsAttentionReason}</p>
              )}
              <p className="text-sm text-orange-600 dark:text-orange-500 mt-2">
                The AI-generated prompt is preserved below. Copy it to generate the image manually using any image tool (Midjourney, DALL·E, Stable Diffusion, etc.), then upload the result.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {hasPrompts && (
                <Button
                  size="sm"
                  onClick={() => setActiveSection('media')}
                  className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Copy className="h-3.5 w-3.5" /> View Prompts
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Content Overview ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <h1 className="text-lg font-bold leading-snug">{content.hook || content.concept}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{content.format?.replace('_', ' ')}</Badge>
                <Badge variant="outline" className="capitalize">{content.pillar?.replace(/_/g, ' ')}</Badge>
                <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                <span className="text-xs text-muted-foreground">v{content.versionNumber}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AssetIcon className={cn('h-4 w-4', assetConf.cls)} />
                <span className={cn('text-sm font-medium', assetConf.cls)}>{assetConf.label}</span>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <div>Created {formatDistanceToNow(new Date(content.createdAt), { addSuffix: true })}</div>
              {content.strategyVersionNumber && <div>Strategy v{content.strategyVersionNumber}</div>}
              <div className="font-mono">{content.id.slice(0, 8)}…</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Section Tabs ── */}
      <div className="flex gap-1.5 border-b pb-3">
        {[
          { key: 'media' as const, label: 'Media & Prompts', icon: ImagePlus, alert: hasFailed },
          { key: 'overview' as const, label: 'Content Details', icon: FileText },
          { key: 'history' as const, label: 'History', icon: History, count: attempts.length },
          { key: 'versions' as const, label: 'Versions', icon: Eye, count: content.versions?.length },
        ].map(({ key, label, icon: Icon, alert, count }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              activeSection === key
                ? alert ? 'bg-orange-500 text-white border-orange-500' : 'bg-primary text-primary-foreground border-primary'
                : alert ? 'border-orange-300 text-orange-600 hover:border-orange-400' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {alert && <span className="h-1.5 w-1.5 rounded-full bg-white ml-0.5" />}
            {count != null && count > 0 && !alert && (
              <span className="text-[10px] opacity-70">({count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Media & Prompts Section ── */}
      {activeSection === 'media' && (
        <AssetPanel
          ideaId={content.id}
          assets={content.assets || []}
          prompts={content.prompts || []}
          onRefresh={handleRefresh}
        />
      )}

      {/* ── Content Details Section ── */}
      {activeSection === 'overview' && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concept</label>
              <p className="text-sm mt-1">{content.concept}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hook</label>
              <p className="text-sm font-medium mt-1 leading-snug">{content.hook}</p>
            </div>
            {content.caption && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption</label>
                <div className="text-sm mt-1 whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 p-3 border">
                  {content.caption}
                </div>
                <CopyButton text={content.caption} label="Copy Caption" />
              </div>
            )}
            {hashtags.length > 0 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hashtags</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hashtags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2">
                  <CopyButton text={hashtags.map((t: string) => t.startsWith('#') ? t : `#${t}`).join(' ')} label="Copy All Hashtags" />
                </div>
              </div>
            )}
            {content.altText && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alt Text</label>
                <p className="text-xs text-muted-foreground mt-1">{content.altText}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── History Section ── */}
      {activeSection === 'history' && (
        <GenerationHistorySection attempts={attempts} />
      )}

      {/* ── Versions Section ── */}
      {activeSection === 'versions' && (
        <div className="space-y-3">
          {!content.versions?.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No version history available.</p>
              </CardContent>
            </Card>
          ) : (
            content.versions.map((v: any, i: number) => (
              <Card key={v.id} className={cn(i === 0 && 'border-primary/30 bg-primary/5')}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">v{v.versionNumber}</span>
                      {i === 0 && <Badge className="text-[10px]">Current</Badge>}
                      <Badge variant="outline" className="text-[10px] capitalize">{v.changedBy}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(v.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  {v.changeReason && <p className="text-xs text-muted-foreground">{v.changeReason}</p>}
                </CardHeader>
                {(v.hook || v.caption) && (
                  <CardContent className="pt-0 space-y-2">
                    {v.hook && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hook</span>
                        <p className="text-xs mt-0.5 font-medium">{v.hook}</p>
                      </div>
                    )}
                    {v.caption && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Caption</span>
                        <p className="text-xs mt-0.5 text-muted-foreground line-clamp-3">{v.caption}</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
