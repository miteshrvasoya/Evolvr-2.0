'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ImagePlus, Copy, Check, RefreshCw, AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type AssetStatus = 'generated' | 'failed' | 'manually_added' | 'pending' | 'generating' | undefined;

interface DraftAsset {
  id?: string;
  storageUrl?: string;
  prompt?: string;
  generationStatus?: AssetStatus;
  source?: string;
  attemptNumber?: number;
  errorCategory?: string;
  errorMessage?: string;
}

interface Draft {
  id: string;
  assets?: DraftAsset[];
  caption?: string;
  hook?: string;
  concept?: string;
  format?: string;
  pillar?: string;
  assetGenerationStatus?: string;
  needsAttention?: boolean;
  needsAttentionReason?: string;
  latestPrompt?: string;
}

function AssetStatusIcon({ status }: { status?: AssetStatus }) {
  switch (status) {
    case 'generated':
    case 'manually_added':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'pending':
    case 'generating':
      return <Clock className="h-4 w-4 text-amber-500 animate-spin" />;
    default:
      return <ImagePlus className="h-4 w-4 text-muted-foreground" />;
  }
}

function AssetStatusBadge({ status }: { status?: AssetStatus }) {
  const LABELS: Record<string, string> = {
    generated: 'Generated', failed: 'Failed', manually_added: 'Manual',
    pending: 'Pending', generating: 'Generating…',
  };
  const VARIANTS: Record<string, 'success' | 'destructive' | 'secondary' | 'outline'> = {
    generated: 'success', manually_added: 'success', failed: 'destructive',
    pending: 'secondary', generating: 'secondary',
  };
  if (!status) return <Badge variant="secondary" className="text-xs">No Media</Badge>;
  return (
    <Badge variant={VARIANTS[status] || 'secondary'} className="text-xs">
      {LABELS[status] || status}
    </Badge>
  );
}

export function ManageDraftDialog({ draft, onApprove, onUpdate, onUpload, onRetry, children }: {
  draft: Draft;
  onApprove: (scheduledAt: string) => Promise<void>;
  onUpdate: (data: { caption?: string; hook?: string }) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onRetry?: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [caption, setCaption] = useState(draft.caption || '');
  const [hook, setHook] = useState(draft.hook || '');

  const asset = draft.assets?.[0];
  const assetStatus = asset?.generationStatus;
  // Use latestPrompt from hook (top-level field) or fall back to asset.prompt
  const promptText = draft.latestPrompt || asset?.prompt || '';
  const hasFailed = assetStatus === 'failed' || (draft.assetGenerationStatus === 'needs_attention');

  async function handleApprove() {
    setLoading(true);
    try {
      await onUpdate({ caption, hook });
      await onApprove(new Date(scheduledAt).toISOString());
      toast({ title: 'Scheduled successfully' });
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to schedule' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await onUpload(file);
      toast({ title: 'Image uploaded' });
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry() {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
      toast({ title: 'Retry queued', description: 'Asset generation retry has been scheduled.' });
    } catch {
      toast({ variant: 'destructive', title: 'Retry failed' });
    } finally {
      setRetrying(false);
    }
  }

  async function handleCopyPrompt() {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Prompt copied to clipboard' });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Manage Draft & Prompts</DialogTitle>
            <Link
              href={`/dashboard/content/${draft.id}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Full Detail <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Media Column */}
          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center gap-2">
              <AssetStatusIcon status={assetStatus} />
              <AssetStatusBadge status={assetStatus} />
              {asset?.attemptNumber && (
                <span className="text-xs text-muted-foreground">Attempt #{asset.attemptNumber}</span>
              )}
            </div>

            {/* Needs attention warning */}
            {hasFailed && draft.needsAttentionReason && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5 text-xs text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-400">
                <p className="font-semibold mb-0.5">Generation Failed</p>
                <p className="text-orange-600/80">{draft.needsAttentionReason}</p>
              </div>
            )}

            {/* Preview */}
            <div className="aspect-square bg-muted rounded-lg border relative overflow-hidden flex items-center justify-center">
              {asset?.storageUrl && (assetStatus === 'generated' || assetStatus === 'manually_added') ? (
                <img src={asset.storageUrl} className="w-full h-full object-cover" alt="Draft" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImagePlus className="h-8 w-8 opacity-30" />
                  <span className="text-xs">
                    {assetStatus === 'generating' || assetStatus === 'pending'
                      ? 'Generating…'
                      : hasFailed
                      ? 'Generation failed'
                      : 'No media generated'}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                <Label htmlFor={`upload-${draft.id}`} className="cursor-pointer bg-white text-black px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" /> Replace Image
                </Label>
                <input type="file" id={`upload-${draft.id}`} className="hidden" accept="image/*" onChange={handleUpload} disabled={loading} />
              </div>
            </div>

            {/* Prompt section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">AI Image Prompt</Label>
                {promptText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPrompt}
                    className="h-6 text-xs gap-1 px-2"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>
              <Textarea
                readOnly
                value={promptText || 'No prompt available.'}
                className="text-xs h-20 bg-muted/50 font-mono resize-none"
              />
            </div>

            {/* Retry action */}
            {hasFailed && onRetry && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full gap-1.5"
                >
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {retrying ? 'Retrying…' : 'Retry Generation'}
                </Button>
                {promptText && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Or copy the prompt above to generate manually, then upload.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Editor Column */}
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-primary uppercase">{draft.format} • {draft.pillar}</span>
              <p className="text-sm text-muted-foreground">Concept: {draft.concept}</p>
            </div>

            <div className="space-y-2">
              <Label>Hook</Label>
              <Input value={hook} onChange={(e) => setHook(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Caption & Hashtags</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="h-40" />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Schedule For</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">The AI suggested this trend-optimized time.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleApprove} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve & Schedule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
