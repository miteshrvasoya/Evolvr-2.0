'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useContentLibrary, type ContentListItem } from '@/lib/hooks/use-content-library';
import { NeedsAttentionBanner } from '@/components/dashboard/needs-attention-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Search, Filter, ArrowRight,
  ImagePlus, Eye, ChevronDown, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function useDebounce<T>(value: T, delay: number): [T] {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return [debounced];
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',                label: 'All'             },
  { key: 'needs_attention', label: 'Needs Attention', assetStatus: 'failed' },
  { key: 'draft',           label: 'Draft'           },
  { key: 'waiting_approval',label: 'Awaiting Review' },
  { key: 'ready',           label: 'Ready'           },
  { key: 'blocked',         label: 'Blocked'         },
];

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reel', carousel: 'Carousel', static_post: 'Post', story: 'Story',
};

const CONTENT_STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'outline' }> = {
  draft:            { label: 'Draft',           variant: 'secondary'   },
  waiting_approval: { label: 'Awaiting Review', variant: 'outline'     },
  ready:            { label: 'Ready',           variant: 'success'     },
  blocked:          { label: 'Blocked',         variant: 'destructive' },
};

// ── Asset Status Indicator ─────────────────────────────────────────────────────

function AssetStatusBadge({ item }: { item: ContentListItem }) {
  const { assetGenerationStatus, primaryAsset } = item;

  if (primaryAsset?.generationStatus === 'generated') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Image Ready
      </span>
    );
  }
  if (primaryAsset?.generationStatus === 'manually_added') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <CheckCircle2 className="h-3 w-3" /> Manually Added
      </span>
    );
  }
  if (assetGenerationStatus === 'needs_attention') {
    return (
      <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
        <AlertTriangle className="h-3 w-3" /> Generation Failed
      </span>
    );
  }
  if (['pending', 'generating'].includes(assetGenerationStatus)) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-500">
        <Clock className="h-3 w-3 animate-spin" /> Generating…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <ImagePlus className="h-3 w-3" /> No media
    </span>
  );
}

// ── Content Card ──────────────────────────────────────────────────────────────

function ContentCard({ item }: { item: ContentListItem }) {
  const statusBadge = CONTENT_STATUS_BADGE[item.status] || { label: item.status, variant: 'secondary' as const };
  const hasImage = !!item.primaryAsset?.storageUrl;

  return (
    <Link
      href={`/dashboard/content/${item.id}`}
      className={cn(
        'group flex flex-col rounded-xl border bg-card overflow-hidden transition-all',
        'hover:shadow-md hover:border-primary/30',
        item.needsAttention && 'border-orange-200 dark:border-orange-800',
      )}
    >
      {/* Image thumbnail */}
      <div className={cn(
        'aspect-video bg-muted relative flex items-center justify-center',
        !hasImage && 'bg-gradient-to-br from-muted to-muted/60',
      )}>
        {hasImage ? (
          <img
            src={item.primaryAsset!.storageUrl}
            alt={item.concept}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImagePlus className="h-8 w-8 text-muted-foreground/20" />
        )}

        {/* Needs attention overlay */}
        {item.needsAttention && (
          <div className="absolute inset-0 bg-orange-500/10 flex items-end">
            <div className="w-full px-2 py-1 bg-orange-500/90 text-white text-[10px] font-semibold truncate">
              ⚠ Generation Failed — Action Required
            </div>
          </div>
        )}

        {/* Format badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-[10px] bg-black/60 text-white border-0 backdrop-blur-sm">
            {FORMAT_LABELS[item.format] || item.format}
          </Badge>
        </div>
      </div>

      {/* Content info */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <p className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {item.hook || item.concept}
        </p>

        {item.caption && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.caption}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <AssetStatusBadge item={item} />
          <Badge variant={statusBadge.variant} className="text-[10px] capitalize">
            {statusBadge.label}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
          <span className="capitalize">{item.pillar?.replace(/_/g, ' ')}</span>
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ activeTab }: { activeTab: string }) {
  if (activeTab === 'needs_attention') {
    return (
      <div className="col-span-full py-16 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400/40" />
        <p className="text-sm font-medium text-muted-foreground">All generated assets are healthy</p>
        <p className="text-xs text-muted-foreground/60">No content needs your attention right now.</p>
      </div>
    );
  }
  return (
    <div className="col-span-full py-16 flex flex-col items-center gap-3 text-center">
      <ImagePlus className="h-10 w-10 text-muted-foreground/20" />
      <p className="text-sm font-medium text-muted-foreground">No content yet</p>
      <p className="text-xs text-muted-foreground/60">
        Trigger the agent to generate content from your active strategy.
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') === 'needs_attention' ? 'needs_attention' : '';
  const [activeTab, setActiveTab] = useState(initialFilter);
  const [rawSearch, setRawSearch] = useState('');
  const [search] = useDebounce(rawSearch, 400);
  const [page, setPage] = useState(1);

  const isNeedsAttention = activeTab === 'needs_attention';

  const { items, total, isLoading, refresh } = useContentLibrary({
    status: isNeedsAttention ? undefined : (activeTab || undefined),
    assetStatus: isNeedsAttention ? 'failed' : undefined,
    search: search || undefined,
    page,
    limit: 18,
  });

  const totalPages = Math.ceil(total / 18);

  function handleTabChange(key: string) {
    setActiveTab(key);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Content Library</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} content item${total !== 1 ? 's' : ''}` : 'Manage your generated content'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Needs Attention banner */}
      <NeedsAttentionBanner />

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap border-b pb-3">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              tab.key === 'needs_attention' && activeTab !== tab.key && 'border-orange-300 text-orange-500 hover:border-orange-400',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by hook, caption, concept…"
          value={rawSearch}
          onChange={e => { setRawSearch(e.target.value); setPage(1); }}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.length === 0 ? (
            <EmptyState activeTab={activeTab} />
          ) : (
            items.map(item => <ContentCard key={item.id} item={item} />)
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
