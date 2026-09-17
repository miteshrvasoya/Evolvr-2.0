'use client';

import { use } from 'react';
import Link from 'next/link';
import { useContentDetail, useGenerationHistory } from '@/lib/hooks/use-content-detail';
import { AssetGenerationPanel } from '@/components/dashboard/asset-generation-panel';
import { PromptPanel } from '@/components/dashboard/prompt-panel';
import { GenerationHistoryPanel } from '@/components/dashboard/generation-history-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  FileText, ImagePlus, History, Sparkles, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'outline' }> = {
  draft:            { label: 'Draft',           variant: 'secondary'   },
  waiting_approval: { label: 'Awaiting Review', variant: 'outline'     },
  ready:            { label: 'Ready',           variant: 'success'     },
  blocked:          { label: 'Blocked',         variant: 'destructive' },
};

const ASSET_STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; cls: string }> = {
  completed:       { label: 'Assets Ready',   icon: CheckCircle2,  cls: 'text-emerald-500' },
  needs_attention: { label: 'Needs Attention',icon: AlertTriangle, cls: 'text-orange-500'  },
  pending:         { label: 'Generating',     icon: Clock,         cls: 'text-amber-500'   },
  generating:      { label: 'Generating',     icon: Clock,         cls: 'text-amber-500'   },
  none:            { label: 'No Assets',      icon: ImagePlus,     cls: 'text-muted-foreground' },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { content, isLoading, refresh } = useContentDetail(id);
  const { attempts, refresh: refreshHistory } = useGenerationHistory(id);

  function handleRefresh() {
    refresh();
    refreshHistory();
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/dashboard/content"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Content Library
        </Link>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Overview card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
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
              {content.strategyVersionNumber && (
                <div>Strategy v{content.strategyVersionNumber}</div>
              )}
              <div className="font-mono">{content.id.slice(0, 8)}…</div>
            </div>
          </div>
        </CardHeader>

        {content.needsAttention && (
          <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2.5 dark:border-orange-800 dark:bg-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-orange-700 dark:text-orange-400">Needs Attention</p>
              <p className="text-orange-600 dark:text-orange-500">{content.needsAttentionReason}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Main tabs */}
      <Tabs defaultValue="content">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="content" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" /> Media &amp; Assets
            {content.needsAttention && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI Prompts
            {content.prompts?.length > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">({content.prompts.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Generation History
            {attempts.length > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">({attempts.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Versions
            {content.versions?.length > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">({content.versions.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Content Tab ── */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6 space-y-5">
              {/* Concept */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concept</label>
                <p className="text-sm mt-1">{content.concept}</p>
              </div>

              {/* Hook */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hook</label>
                <p className="text-sm font-medium mt-1 leading-snug">{content.hook}</p>
              </div>

              {/* Caption */}
              {content.caption && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption</label>
                  <div className="text-sm mt-1 whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 p-3 border">
                    {content.caption}
                  </div>
                </div>
              )}

              {/* Hashtags */}
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
                </div>
              )}

              {/* Alt text */}
              {content.altText && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alt Text</label>
                  <p className="text-xs text-muted-foreground mt-1">{content.altText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Assets Tab ── */}
        <TabsContent value="assets" className="mt-4">
          <AssetGenerationPanel
            ideaId={content.id}
            assets={content.assets || []}
            prompts={content.prompts || []}
            assetGenerationStatus={content.assetGenerationStatus}
            needsAttention={content.needsAttention}
            needsAttentionReason={content.needsAttentionReason}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* ── Prompts Tab ── */}
        <TabsContent value="prompts" className="mt-4">
          <PromptPanel
            ideaId={content.id}
            prompts={content.prompts || []}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* ── Generation History Tab ── */}
        <TabsContent value="history" className="mt-4">
          <GenerationHistoryPanel attempts={attempts} />
        </TabsContent>

        {/* ── Versions Tab ── */}
        <TabsContent value="versions" className="mt-4">
          <div className="space-y-3">
            {!content.versions?.length ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No version history available.</p>
                </CardContent>
              </Card>
            ) : (
              content.versions.map((v, i) => (
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
                    {v.changeReason && (
                      <p className="text-xs text-muted-foreground">{v.changeReason}</p>
                    )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
