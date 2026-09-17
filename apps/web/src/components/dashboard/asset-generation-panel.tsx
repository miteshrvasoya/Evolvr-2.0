'use client';

import { useState } from 'react';
import { useAssetActions } from '@/lib/hooks/use-asset-actions';
import type { ContentAsset, ContentPrompt } from '@/lib/hooks/use-content-detail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Copy, Upload, Sparkles, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, Check, ImagePlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';

interface AssetGenerationPanelProps {
  ideaId: string;
  assets: ContentAsset[];
  prompts: ContentPrompt[];
  assetGenerationStatus: string;
  needsAttention: boolean;
  needsAttentionReason?: string;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  generated:       { label: 'Generated',       icon: CheckCircle2, cls: 'text-emerald-500' },
  failed:          { label: 'Failed',           icon: XCircle,      cls: 'text-red-500'     },
  manually_added:  { label: 'Manually Added',   icon: CheckCircle2, cls: 'text-blue-500'    },
  pending:         { label: 'Pending',          icon: Clock,        cls: 'text-amber-500'   },
  generating:      { label: 'Generating…',      icon: Loader2,      cls: 'text-amber-500'   },
  needs_attention: { label: 'Needs Attention',  icon: AlertTriangle,cls: 'text-orange-500'  },
};

const ERROR_CATEGORY_LABELS: Record<string, { label: string; guidance: string }> = {
  timeout:        { label: 'Timeout',             guidance: 'The provider took too long. Retry when the service recovers.' },
  rate_limited:   { label: 'Rate Limited',         guidance: 'Wait a few minutes and retry.' },
  provider_error: { label: 'Provider Error',       guidance: 'The provider had an internal error. Retry or copy the prompt.' },
  auth_error:     { label: 'Authentication Error', guidance: 'Check your provider API key in settings.' },
  content_policy: { label: 'Content Policy',      guidance: 'The prompt was rejected by content filters. Use Improve Prompt.' },
  invalid_prompt: { label: 'Invalid Prompt',      guidance: 'The prompt format was rejected. Edit or improve the prompt.' },
  quota_exceeded: { label: 'Quota Exceeded',      guidance: 'Your provider quota is exhausted. Upgrade or use manual generation.' },
  transient:      { label: 'Transient Error',     guidance: 'A temporary network/service error. Retry is likely to succeed.' },
  permanent:      { label: 'Permanent Error',     guidance: 'This error cannot be retried automatically. Use the prompt manually.' },
};

function CopyButton({ text, label = 'Copy Prompt' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
}

function AssetPreview({ asset }: { asset: ContentAsset }) {
  if (!asset.storageUrl) return null;
  const isVideo = asset.assetType === 'video_placeholder' || asset.mimeType?.startsWith('video');
  return (
    <div className="rounded-lg overflow-hidden border bg-muted aspect-square max-w-[200px]">
      {isVideo ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Video</div>
      ) : (
        <img src={asset.storageUrl} alt="Generated asset" className="w-full h-full object-cover" />
      )}
    </div>
  );
}

function SingleAssetPanel({
  ideaId,
  asset,
  prompts,
  onRefresh,
}: {
  ideaId: string;
  asset: ContentAsset | undefined;
  prompts: ContentPrompt[];
  onRefresh: () => void;
}) {
  const assetType = asset?.assetType || 'image';
  const latestPrompt = prompts.find(p => p.assetType === assetType);
  const [showPrompt, setShowPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);

  const {
    isRetrying, isImproving, isGenerating, retryAsset, improvePrompt, generateWithPrompt, uploadAsset
  } = useAssetActions(ideaId, () => {
    onRefresh();
    toast({ title: 'Generation queued', description: 'Asset generation has been started.' });
  });

  const status = asset?.generationStatus || 'none';
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS['pending']!;
  const { Icon, cls } = { Icon: statusInfo.icon, cls: statusInfo.cls };

  const errorInfo = asset?.errorCategory ? ERROR_CATEGORY_LABELS[asset.errorCategory] : null;
  const isFailed = status === 'failed' || !asset;
  const isGeneratedOk = status === 'generated' || status === 'manually_added';

  async function handleRetry() {
    const result = await retryAsset(assetType);
    if ((result as any)?.alreadyRunning) {
      toast({ title: 'Already running', description: 'A generation job is already in progress.' });
    } else {
      toast({ title: 'Retry queued', description: 'Asset generation retry has been queued.' });
    }
  }

  async function handleImprove() {
    const improved = await improvePrompt(assetType);
    toast({ title: 'Prompt improved', description: 'A new improved prompt version has been saved.' });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAsset(file);
      toast({ title: 'Asset uploaded', description: 'Your image has been attached to this content.' });
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cls, status === 'generating' && 'animate-spin')} />
          <span className="font-semibold text-sm capitalize">{assetType.replace('_', ' ')}</span>
          <Badge
            variant={isGeneratedOk ? 'success' : isFailed ? 'destructive' : 'secondary'}
            className="text-xs capitalize"
          >
            {statusInfo.label}
          </Badge>
        </div>

        {asset && (
          <span className="text-xs text-muted-foreground">
            Attempt #{asset.attemptNumber || 1}
          </span>
        )}
      </div>

      {/* Preview */}
      {isGeneratedOk && asset && <AssetPreview asset={asset} />}

      {/* Failure detail */}
      {isFailed && asset?.errorCategory && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
          <p className="text-xs font-semibold text-destructive">
            {errorInfo?.label || asset.errorCategory}
          </p>
          <p className="text-xs text-muted-foreground">{asset.errorMessage}</p>
          {errorInfo?.guidance && (
            <p className="text-xs text-amber-600 mt-1">→ {errorInfo.guidance}</p>
          )}
        </div>
      )}

      {/* No asset yet (never generated) */}
      {!asset && (
        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          No asset has been generated yet.
        </div>
      )}

      {/* AI Prompt */}
      {latestPrompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowPrompt(v => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              AI Prompt v{latestPrompt.promptVersion}
              <Badge variant="outline" className="text-[10px] ml-1 capitalize">{latestPrompt.source.replace('_', ' ')}</Badge>
            </button>
            <CopyButton text={latestPrompt.promptText} />
          </div>

          {showPrompt && (
            <div className="rounded-lg bg-muted/40 border p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
              {latestPrompt.promptText}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {(isFailed || !asset) && latestPrompt && (
          <Button
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="gap-1.5"
          >
            {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isRetrying ? 'Retrying…' : 'Retry'}
          </Button>
        )}

        {(isFailed || !asset) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleImprove}
            disabled={isImproving}
            className="gap-1.5"
          >
            {isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isImproving ? 'Improving…' : 'Improve Prompt'}
          </Button>
        )}

        {isGeneratedOk && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImprove}
            disabled={isImproving}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        )}

        {/* Manual upload */}
        <label className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer',
          'hover:bg-accent hover:text-accent-foreground',
          (uploading) && 'opacity-50 pointer-events-none',
        )}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Upload Image'}
          <input type="file" className="hidden" accept="image/*,video/*" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Manual fallback callout when failed */}
      {isFailed && latestPrompt && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs space-y-1 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800 dark:text-amber-400">Generation failed — your prompt is ready</p>
          <p className="text-amber-700 dark:text-amber-500">
            You can copy this prompt and generate the image using another tool (Midjourney, DALL·E, etc.), then upload it above.
          </p>
        </div>
      )}
    </div>
  );
}

export function AssetGenerationPanel({
  ideaId,
  assets,
  prompts,
  assetGenerationStatus,
  needsAttention,
  needsAttentionReason,
  onRefresh,
}: AssetGenerationPanelProps) {
  // Group assets and prompts by asset type
  const assetTypes = ['image', 'video_placeholder'];
  const assetByType = Object.fromEntries(
    assetTypes.map(t => [t, assets.find(a => a.assetType === t)])
  );
  const hasAnyAsset = assets.length > 0;
  const hasAnyPrompt = prompts.length > 0;

  if (!hasAnyPrompt && !hasAnyAsset) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-2">
        <ImagePlus className="h-8 w-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">No media generated yet</p>
        <p className="text-xs text-muted-foreground/60">
          Asset generation will run after content is approved, or trigger it manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {needsAttention && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-orange-700 dark:text-orange-400">Needs Attention</p>
            <p className="text-orange-600 dark:text-orange-500">{needsAttentionReason}</p>
          </div>
        </div>
      )}

      {/* Show image panel */}
      {(assetByType['image'] || prompts.some(p => p.assetType === 'image')) && (
        <SingleAssetPanel
          ideaId={ideaId}
          asset={assetByType['image']}
          prompts={prompts.filter(p => p.assetType === 'image')}
          onRefresh={onRefresh}
        />
      )}

      {/* Show video panel if applicable */}
      {(assetByType['video_placeholder'] || prompts.some(p => p.assetType === 'video_placeholder')) && (
        <SingleAssetPanel
          ideaId={ideaId}
          asset={assetByType['video_placeholder']}
          prompts={prompts.filter(p => p.assetType === 'video_placeholder')}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
