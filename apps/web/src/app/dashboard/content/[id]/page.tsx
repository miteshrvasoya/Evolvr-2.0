'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useContentDetail,
  useGenerationHistory,
  type ContentPrompt,
} from '@/lib/hooks/use-content-detail';
import { useAssetActions } from '@/lib/hooks/use-asset-actions';
import { useContentSchedule } from '@/lib/hooks/use-schedule';
import { MediaUploader } from '@/components/media/MediaUploader';
import { ScheduleRecommendationCard, ActiveSchedulePanel, ScheduleVersionHistory } from '@/components/scheduling/schedule-cards';
import { ScheduleModal } from '@/components/scheduling/schedule-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  ImagePlus, Sparkles, Copy, Check, Upload, Loader2, XCircle,
  History, ChevronDown, ChevronRight, Pencil, Zap, Bot, User,
  Eye, FileText, Image, Film, Hash, Calendar,
  ExternalLink, RotateCcw, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  draft:            { label: 'Draft',            cls: 'bg-slate-100 text-slate-700 border-slate-200',      dot: 'bg-slate-400' },
  waiting_approval: { label: 'Awaiting Review',  cls: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-400' },
  ready:            { label: 'Ready to Publish', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  blocked:          { label: 'Blocked',           cls: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-400' },
};

const ASSET_STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string; bg: string }> = {
  completed:       { label: 'Assets Ready',    icon: CheckCircle2,  cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  needs_attention: { label: 'Needs Attention', icon: AlertTriangle, cls: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  pending:         { label: 'Generating...',   icon: Clock,         cls: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  generating:      { label: 'Generating...',   icon: Clock,         cls: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  none:            { label: 'No Assets Yet',   icon: ImagePlus,     cls: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  AI_GENERATED:   { label: 'AI Generated',  icon: Bot,    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  MANUALLY_ADDED: { label: 'Manual Upload', icon: Upload, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  USER_UPLOADED:  { label: 'User Uploaded', icon: User,   cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  ai_generated:   { label: 'AI Generated',  icon: Bot,    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  manually_added: { label: 'Manual Upload', icon: Upload, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  user_uploaded:  { label: 'User Uploaded', icon: User,   cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const ERROR_LABELS: Record<string, string> = {
  timeout:        'Request Timeout',
  rate_limited:   'Rate Limited',
  provider_error: 'Provider Error',
  content_policy: 'Content Policy Violation',
  invalid_prompt: 'Invalid Prompt',
  quota_exceeded: 'Quota Exceeded',
  permanent:      'Permanent Error',
  transient:      'Transient Error',
};

function CopyButton({ text, label = 'Copy', size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button
      variant="ghost" size="sm"
      onClick={handleCopy}
      className={cn('gap-1.5 transition-all', size === 'xs' ? 'h-7 text-xs px-2' : 'h-8 text-xs')}
    >
      {copied
        ? <><Check className="h-3 w-3 text-emerald-500" /> Copied!</>
        : <><Copy className="h-3 w-3" /> {label}</>
      }
    </Button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
      {children}
    </p>
  );
}

function PromptCard({
  prompt, isCurrent, ideaId, onRefresh, hasFailed,
}: {
  prompt: ContentPrompt; isCurrent: boolean; ideaId: string;
  onRefresh: () => void; hasFailed: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.promptText);
  const [saving, setSaving] = useState(false);
  const { editPrompt, isImproving, improvePrompt } = useAssetActions(ideaId, onRefresh);

  const promptSourceColors = {
    ai_generated: 'bg-purple-50 text-purple-700 border-purple-200',
    user_edited:  'bg-blue-50 text-blue-700 border-blue-200',
    improved:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  } as const;
  const promptSourceLabels = { ai_generated: 'AI Generated', user_edited: 'User Edited', improved: 'AI Improved' } as const;
  const srcColor = promptSourceColors[prompt.source as keyof typeof promptSourceColors] ?? promptSourceColors.ai_generated;
  const srcLabel = promptSourceLabels[prompt.source as keyof typeof promptSourceLabels] ?? 'Generated';

  async function handleSave() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await editPrompt(prompt.id, editText);
      toast({ title: 'Prompt saved', description: 'New version created.' });
      setEditing(false); onRefresh();
    } catch { toast({ variant: 'destructive', title: 'Failed to save' }); }
    finally { setSaving(false); }
  }

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-200',
      isCurrent && hasFailed  ? 'border-orange-200 bg-gradient-to-b from-orange-50/60 to-amber-50/40' :
      isCurrent && !hasFailed ? 'border-primary/25 bg-gradient-to-b from-primary/5 to-transparent' :
      'border-border/60 bg-muted/20',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-semibold">Prompt v{prompt.promptVersion}</span>
          {isCurrent && <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Current</span>}
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', srcColor)}>{srcLabel}</span>
          <span className="text-[10px] text-muted-foreground capitalize hidden sm:inline">{prompt.assetType.replace('_', ' ')}</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40">
          {editing ? (
            <div className="space-y-3 pt-3">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-xs font-mono rounded-lg border bg-background p-3 h-36 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1.5">
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save as New Version
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(prompt.promptText); }} className="h-8 text-xs">Cancel</Button>
                <p className="text-[10px] text-muted-foreground ml-auto">Original is always preserved</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-3">
              <div className={cn(
                'rounded-lg p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words border',
                hasFailed && isCurrent ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-muted/40 border-border/60 text-foreground',
              )}>
                {prompt.promptText}
              </div>
              {hasFailed && isCurrent && (
                <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3 text-xs flex gap-2.5">
                  <Zap className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 mb-0.5">Use this prompt manually</p>
                    <p className="text-amber-700 leading-relaxed">Copy into Midjourney, DALL-E, Stable Diffusion, then upload the result above.</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <CopyButton text={prompt.promptText} label="Copy Prompt" />
                {isCurrent && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs gap-1.5">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try { await improvePrompt(prompt.assetType); toast({ title: 'Prompt improved' }); onRefresh(); }
                        catch { toast({ variant: 'destructive', title: 'Improve failed' }); }
                      }}
                      disabled={isImproving}
                      className="h-8 text-xs gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      {isImproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Improve
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MediaPreviewCard({ asset, onReplace }: { asset: any; onReplace: () => void }) {
  const srcKey = asset.source?.toUpperCase() ?? asset.source;
  const srcConf = SOURCE_CONFIG[srcKey] ?? SOURCE_CONFIG[asset.source] ?? { label: asset.source ?? 'Unknown', icon: Image, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
  const SrcIcon = srcConf.icon;
  const isVideo = asset.mimeType?.startsWith('video/') || asset.assetType === 'video';

  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">
      <div className="relative group bg-gradient-to-br from-slate-100 to-slate-200 aspect-[4/3] overflow-hidden">
        {isVideo
          ? <video src={asset.storageUrl} controls className="w-full h-full object-contain" />
          : <img src={asset.storageUrl} alt="Media asset" className="w-full h-full object-contain" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-3">
          <a href={asset.storageUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2 py-1 rounded-full border border-white/30 transition-colors">
            <ExternalLink className="h-3 w-3" /> View Full
          </a>
          <button onClick={onReplace}
            className="text-[10px] font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2 py-1 rounded-full border border-white/30 transition-colors">
            Replace
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-border/40 bg-muted/20">
        <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border', srcConf.cls)}>
          <SrcIcon className="h-3 w-3" />
          {srcConf.label}
        </div>
        {asset.mimeType && <span className="text-[10px] text-muted-foreground font-mono uppercase">{asset.mimeType.split('/')[1]}</span>}
      </div>
    </div>
  );
}

function GenerationHistorySection({ attempts }: { attempts: any[] }) {
  if (!attempts.length) return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center">
      <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">No generation attempts yet</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {attempts.map((a, i) => (
        <div key={a.id} className={cn(
          'rounded-2xl border overflow-hidden',
          a.status === 'failed'    ? 'border-red-200 bg-red-50/30' :
          a.status === 'generated' ? 'border-emerald-200 bg-emerald-50/20' :
          'border-border/60 bg-muted/10',
        )}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                a.status === 'failed' ? 'bg-red-100' : a.status === 'generated' ? 'bg-emerald-100' : 'bg-amber-100')}>
                {a.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> :
                 a.status === 'generated' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                 <Clock className="h-4 w-4 text-amber-500" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{a.assetType?.replace('_', ' ')}</span>
                  <span className="text-xs text-muted-foreground">Attempt #{a.attemptNumber}</span>
                  {i === 0 && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Latest</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  {a.provider && <span className="font-mono">{a.provider}</span>}
                  {a.durationMs != null && <span>{(a.durationMs / 1000).toFixed(2)}s</span>}
                  {a.completedAt && <span>{format(new Date(a.completedAt), 'MMM d, HH:mm')}</span>}
                </div>
              </div>
            </div>
            <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border',
              a.status === 'failed' ? 'bg-red-50 text-red-600 border-red-200' :
              a.status === 'generated' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              'bg-amber-50 text-amber-600 border-amber-200')}>
              {a.status}
            </div>
          </div>
          {a.status === 'failed' && (a.errorMessage || a.errorCategory) && (
            <div className="px-4 pb-3 space-y-1 border-t border-red-100">
              <div className="flex items-center gap-1.5 mt-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-700">{ERROR_LABELS[a.errorCategory] || a.errorCategory || 'Error'}</span>
              </div>
              {a.errorMessage && (
                <p className="text-xs font-mono text-red-600 ml-5 bg-red-50/80 rounded px-2 py-1 border border-red-100">{a.errorMessage}</p>
              )}
              {a.idempotencyKey && <p className="text-[10px] text-muted-foreground ml-5 truncate font-mono">Key: {a.idempotencyKey}</p>}
            </div>
          )}
          {a.promptText && (
            <div className="px-4 pb-3 border-t border-border/40">
              <div className="flex items-center justify-between mt-2 mb-1.5">
                <SectionLabel>Prompt Used</SectionLabel>
                <div className="flex gap-1">
                  {a.promptVersion && <span className="text-[10px] bg-muted text-muted-foreground font-mono px-1.5 py-0.5 rounded border">v{a.promptVersion}</span>}
                  {a.promptSource && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 capitalize">{a.promptSource.replace('_', ' ')}</span>}
                </div>
              </div>
              <p className="text-[11px] font-mono bg-muted/50 rounded-lg px-3 py-2 leading-relaxed text-foreground/80 line-clamp-3 border border-border/40">{a.promptText}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface PageProps { params: { id: string }; }

export default function ContentDetailPage({ params }: PageProps) {
  const { id } = params;
  const { content, isLoading, refresh } = useContentDetail(id);
  const { attempts, refresh: refreshHistory } = useGenerationHistory(id);
  const [activeSection, setActiveSection] = useState<'media' | 'overview' | 'history' | 'versions' | 'schedule'>('media');
  const [uploading, setUploading] = useState(false);
  const { isRetrying, retryAsset } = useAssetActions(id, () => { refresh(); refreshHistory(); });

  // Schedule state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalMode, setScheduleModalMode] = useState<'new' | 'edit' | 'reschedule'>('new');
  const {
    schedule, recommendations, mediaStatus, isLoading: schedLoading,
    generateRecommendation, acceptSchedule, editSchedule, cancelSchedule,
    reschedule, retryPublish,
  } = useContentSchedule(id);

  function handleRefresh() { refresh(); refreshHistory(); }

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6 animate-pulse">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-6xl py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold">Content not found</p>
        <p className="text-sm text-muted-foreground">This content may have been deleted or you do not have access.</p>
        <Link href="/dashboard/content"><Button variant="outline" className="gap-1.5 mt-2"><ArrowLeft className="h-4 w-4" /> Back to Library</Button></Link>
      </div>
    );
  }

  const statusConf  = STATUS_CONFIG[content.status] ?? { label: content.status, cls: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
  const assetConf   = ASSET_STATUS_CONFIG[content.assetGenerationStatus] ?? ASSET_STATUS_CONFIG['none']!;
  const AssetIcon   = assetConf.icon;
  const hashtags    = Array.isArray(content.hashtags) ? content.hashtags : [];
  const hasFailed   = content.assetGenerationStatus === 'needs_attention';
  const hasPrompts  = (content.prompts?.length ?? 0) > 0;
  const assets      = content.assets ?? [];
  const prompts     = content.prompts ?? [];
  const mediaReqs   = content.mediaRequirements ?? [];
  const activeImages = assets.filter(a => ['image', 'IMAGE', 'carousel', 'CAROUSEL'].includes(a.assetType) && (a.assetStatus === 'ACTIVE' || (a as any).status === 'ACTIVE'));
  if (activeImages.length === 0) {
    const fallback = assets.find(a => ['image', 'IMAGE', 'carousel', 'CAROUSEL'].includes(a.assetType));
    if (fallback) activeImages.push(fallback);
  }
  const imageReq    = mediaReqs.find(r => ['image', 'IMAGE', 'carousel', 'CAROUSEL'].includes(r.mediaType));
  const videoReq    = mediaReqs.find(r => ['video', 'VIDEO', 'video_placeholder'].includes(r.mediaType));
  const imagePrompts = prompts.filter(p => p.assetType.toLowerCase() === 'image' || p.assetType.toLowerCase() === 'carousel');
  const videoPrompts = prompts.filter(p => p.assetType.toLowerCase() === 'video_placeholder' || p.assetType.toLowerCase() === 'video');
  const latestAttempt = attempts[0];
  const hasError = latestAttempt?.status === 'failed';

  const tabs = [
    { key: 'media'    as const, label: 'Media & Prompts', icon: Image,    alert: hasFailed, count: null },
    { key: 'overview' as const, label: 'Content',         icon: FileText, alert: false,     count: null },
    { key: 'schedule' as const, label: 'Schedule',        icon: Calendar, alert: false,     count: null },
    { key: 'history'  as const, label: 'History',         icon: History,  alert: false,     count: attempts.length },
    { key: 'versions' as const, label: 'Versions',        icon: Eye,      alert: false,     count: content.versions?.length },
  ];

  const latestRec = recommendations?.[0] ?? null;

  return (
    <div className="max-w-6xl space-y-6 pb-20">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard/content" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Content Library
        </Link>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Hero Header */}
      <div className={cn(
        'rounded-2xl border p-5 space-y-4',
        hasFailed ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/60' : 'border-border bg-card',
      )}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0 space-y-3">
            <h1 className="text-xl font-bold leading-snug tracking-tight">{content.hook || content.concept}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', statusConf.cls)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', statusConf.dot)} />
                {statusConf.label}
              </div>
              <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', assetConf.bg, assetConf.cls)}>
                <AssetIcon className="h-3.5 w-3.5" />
                {assetConf.label}
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/60 capitalize font-medium">{content.format?.replace('_', ' ')}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/60 capitalize font-medium">{content.pillar?.replace(/_/g, ' ')}</span>
              <span className="text-xs text-muted-foreground">v{content.versionNumber}</span>
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground space-y-0.5 shrink-0">
            <div className="flex items-center gap-1 justify-end"><Calendar className="h-3 w-3" /> {formatDistanceToNow(new Date(content.createdAt), { addSuffix: true })}</div>
            {content.strategyVersionNumber && <div>Strategy v{content.strategyVersionNumber}</div>}
            <div className="font-mono opacity-60">{content.id.slice(0, 8)}...</div>
          </div>
        </div>
        {hasFailed && (
          <div className="flex items-start gap-3 rounded-xl bg-white/70 border border-orange-200 p-3.5">
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-800">Media Generation Failed</p>
              {content.needsAttentionReason && <p className="text-xs text-orange-700 mt-0.5">{content.needsAttentionReason}</p>}
              <p className="text-xs text-orange-600 mt-1 leading-relaxed">The AI prompt is preserved below. Copy it into Midjourney, DALL-E, or Stable Diffusion — then upload the result.</p>
            </div>
            {hasPrompts && (
              <Button size="sm" onClick={() => setActiveSection('media')} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shrink-0 text-xs h-8">
                <Copy className="h-3.5 w-3.5" /> View Prompt
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/50 w-fit">
        {tabs.map(({ key, label, icon: Icon, alert, count }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
              activeSection === key
                ? alert ? 'bg-orange-500 text-white shadow-sm' : 'bg-background text-foreground shadow-sm border border-border/60'
                : alert ? 'text-orange-600 hover:bg-orange-50' : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {alert && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {count != null && count > 0 && !alert && (
              <span className={cn('text-[10px] px-1 rounded-full font-bold', activeSection === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MEDIA & PROMPTS */}
      {activeSection === 'media' && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] xl:grid-cols-[480px,1fr] gap-6 items-start">
          {/* Left: Media Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                Image Media
                {imageReq?.status && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                    imageReq.status === 'READY' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    imageReq.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200')}>
                    {imageReq.status}
                  </span>
                )}
              </h2>
              {(imageReq?.status === 'FAILED' || activeImages.length === 0) && imagePrompts.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => retryAsset('image')} disabled={isRetrying} className="h-7 text-xs gap-1.5">
                  {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Retry
                </Button>
              )}
            </div>

            {activeImages.length > 0 ? (
              <div className={cn("grid gap-4", activeImages.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {activeImages.map((img, i) => (
                  <MediaPreviewCard key={img.id || i} asset={img} onReplace={() => setUploading(v => !v)} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/10 aspect-[4/3] flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                  <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">No media yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Upload manually or retry AI generation</p>
                </div>
                {!uploading && (
                  <Button size="sm" variant="outline" onClick={() => setUploading(true)} className="gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" /> Upload Manually
                  </Button>
                )}
              </div>
            )}

            {uploading && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <MediaUploader 
                  contentIdeaId={id} 
                  mediaRequirement={imageReq ?? { id: 'new', mediaType: 'IMAGE' } as any} 
                  onUploadComplete={() => { setUploading(false); handleRefresh(); }} 
                />
                <Button variant="ghost" size="sm" onClick={() => setUploading(false)} className="text-xs w-full">Cancel</Button>
              </div>
            )}

            {hasError && activeImages.length === 0 && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm font-semibold text-red-700">
                    {ERROR_LABELS[latestAttempt?.errorCategory] ?? latestAttempt?.errorCategory ?? 'Generation Failed'}
                  </p>
                </div>
                {latestAttempt?.errorMessage && (
                  <p className="text-xs font-mono text-red-600 ml-6 bg-red-100/60 rounded px-2 py-1 border border-red-200">{latestAttempt.errorMessage}</p>
                )}
                <div className="flex items-center gap-1.5 ml-6 text-[10px] text-red-600">
                  <Info className="h-3 w-3" />
                  {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} — Upload manually using the prompt on the right
                </div>
              </div>
            )}

            {videoPrompts.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  Video Media
                  {videoReq?.status && (
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                      videoReq.status === 'READY' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                      {videoReq.status}
                    </span>
                  )}
                </h2>
                {videoReq && <MediaUploader contentIdeaId={id} mediaRequirement={videoReq} onUploadComplete={handleRefresh} />}
              </div>
            )}
          </div>

          {/* Right: Prompts Panel */}
          <div className="space-y-4">
            {imagePrompts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <h2 className="text-sm font-bold">Image Prompts</h2>
                  <span className="text-xs text-muted-foreground">({imagePrompts.length} version{imagePrompts.length !== 1 ? 's' : ''})</span>
                </div>
                {imagePrompts.map((p, i) => (
                  <PromptCard key={p.id} prompt={p} isCurrent={i === 0} ideaId={id} onRefresh={handleRefresh} hasFailed={hasFailed} />
                ))}
              </div>
            )}
            {videoPrompts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-blue-500" />
                  <h2 className="text-sm font-bold">Video Prompts</h2>
                </div>
                {videoPrompts.map((p, i) => (
                  <PromptCard key={p.id} prompt={p} isCurrent={i === 0} ideaId={id} onRefresh={handleRefresh} hasFailed={false} />
                ))}
              </div>
            )}
            {imagePrompts.length === 0 && videoPrompts.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No AI prompts yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Prompts are generated automatically when the agent creates content.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENT OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
            <SectionLabel>Concept</SectionLabel>
            <p className="text-sm leading-relaxed">{content.concept}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
            <SectionLabel>Hook</SectionLabel>
            <p className="text-sm font-semibold leading-snug">{content.hook}</p>
          </div>
          {content.caption && (
            <div className="md:col-span-2 rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Caption</SectionLabel>
                <CopyButton text={content.caption} label="Copy Caption" size="xs" />
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 bg-muted/30 rounded-xl p-4 border border-border/40">
                {content.caption}
              </div>
            </div>
          )}
          {hashtags.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Hashtags ({hashtags.length})</SectionLabel>
                <CopyButton text={hashtags.map((t: string) => t.startsWith('#') ? t : '#' + t).join(' ')} label="Copy All" size="xs" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-primary/8 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                    {tag.startsWith('#') ? tag : '#' + tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {content.altText && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
              <SectionLabel>Alt Text</SectionLabel>
              <p className="text-xs text-muted-foreground leading-relaxed italic">"{content.altText}"</p>
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">Generation History</h2>
            {attempts.length > 0 && <span className="text-xs text-muted-foreground">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</span>}
          </div>
          <GenerationHistorySection attempts={attempts} />
        </div>
      )}

      {/* VERSIONS */}
      {activeSection === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">Content Versions</h2>
          </div>
          {!content.versions?.length ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center">
              <Eye className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No version history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {content.versions.map((v: any, i: number) => (
                <div key={v.id} className={cn('rounded-2xl border overflow-hidden', i === 0 ? 'border-primary/25 bg-primary/5' : 'border-border/60 bg-card')}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">v{v.versionNumber}</span>
                      {i === 0 && <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Current</span>}
                      <span className="text-xs capitalize text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">{v.changedBy}</span>
                      {v.changeReason && <span className="text-xs text-muted-foreground italic hidden sm:inline">— {v.changeReason}</span>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(v.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                  {(v.hook || v.caption) && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border/40">
                      {v.hook && <div className="pt-3"><SectionLabel>Hook</SectionLabel><p className="text-xs font-medium">{v.hook}</p></div>}
                      {v.caption && <div><SectionLabel>Caption</SectionLabel><p className="text-xs text-muted-foreground line-clamp-2">{v.caption}</p></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SCHEDULE */}
      {activeSection === 'schedule' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">Publishing Schedule</h2>
            </div>
            {!schedule && !schedLoading && (
              <Button
                size="sm" variant="outline"
                onClick={() => generateRecommendation()}
                disabled={schedLoading}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Get AI Recommendation
              </Button>
            )}
          </div>

          {schedLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <span className="ml-2 text-sm text-muted-foreground">Loading schedule…</span>
            </div>
          )}

          {!schedLoading && !schedule && !latestRec && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-semibold">No schedule yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Ask the AI to recommend a publishing time, or pick one manually.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button size="sm" onClick={() => generateRecommendation()} disabled={schedLoading}
                  className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white">
                  <Sparkles className="h-3.5 w-3.5" />AI Recommendation
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { setScheduleModalMode('new'); setScheduleModalOpen(true); }}>
                  Pick Manually
                </Button>
              </div>
            </div>
          )}

          {!schedule && latestRec && (
            <ScheduleRecommendationCard
              recommendation={latestRec}
              alternatives={latestRec.candidateWindows}
              onAccept={async (params) => { await acceptSchedule(params); }}
              onChooseOther={() => { setScheduleModalMode('new'); setScheduleModalOpen(true); }}
              onRegenerate={() => generateRecommendation()}
              isLoading={schedLoading}
            />
          )}

          {schedule && (
            <ActiveSchedulePanel
              schedule={schedule}
              mediaStatus={mediaStatus}
              onEdit={() => { setScheduleModalMode('edit'); setScheduleModalOpen(true); }}
              onReschedule={() => { setScheduleModalMode('reschedule'); setScheduleModalOpen(true); }}
              onCancel={async () => {
                if (confirm('Cancel this scheduled post?')) await cancelSchedule(schedule.id);
              }}
              onRetryPublish={() => retryPublish(schedule.id)}
              isLoading={schedLoading}
            />
          )}

          {schedule?.versions && schedule.versions.length > 1 && (
            <ScheduleVersionHistory versions={schedule.versions} />
          )}
        </div>
      )}

      {scheduleModalOpen && (
        <ScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          initialDate={schedule?.scheduledAt}
          initialTimezone={schedule?.scheduleTimezone}
          title={scheduleModalMode === 'edit' ? 'Edit Schedule' :
                 scheduleModalMode === 'reschedule' ? 'Reschedule Post' : 'Choose Publishing Time'}
          confirmLabel={scheduleModalMode === 'edit' ? 'Update Schedule' :
                        scheduleModalMode === 'reschedule' ? 'Confirm Reschedule' : 'Confirm Schedule'}
          isLoading={schedLoading}
          onConfirm={async (params) => {
            if (scheduleModalMode === 'new') await acceptSchedule(params);
            else if (scheduleModalMode === 'edit' && schedule) await editSchedule(schedule.id, params);
            else if (scheduleModalMode === 'reschedule' && schedule) await reschedule(schedule.id, params);
            setScheduleModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
