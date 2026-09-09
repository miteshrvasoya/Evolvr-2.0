'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { ResearchRun, ResearchCategory } from '@evolvr/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES: { label: string; value: ResearchCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Trend', value: 'trend' },
  { label: 'Competitor', value: 'competitor' },
  { label: 'Audience', value: 'audience' },
  { label: 'Content', value: 'content' },
  { label: 'Platform Update', value: 'platform_update' },
];

const categoryColors: Record<string, 'info' | 'warning' | 'success' | 'secondary'> = {
  trend: 'info',
  competitor: 'warning',
  audience: 'success',
  content: 'secondary',
  platform_update: 'info',
};

function ResearchRunCard({ run }: { run: ResearchRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={categoryColors[run.query.category] ?? 'secondary'} className="capitalize">
                {run.query.category.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{run.query.rationale}</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1 hover:bg-accent rounded"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-1">Summary</h4>
            <p className="text-sm text-muted-foreground">{run.synthesizedFindings.summary}</p>
          </div>

          {run.synthesizedFindings.keyInsights.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Key Insights</h4>
              <ul className="space-y-1">
                {run.synthesizedFindings.keyInsights.map((insight, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary shrink-0">•</span>
                    <span className="text-muted-foreground">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.synthesizedFindings.actionableRecommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Recommendations</h4>
              <ul className="space-y-1">
                {run.synthesizedFindings.actionableRecommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-600 shrink-0">→</span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <Badge variant={run.synthesizedFindings.confidenceLevel === 'high' ? 'success' : run.synthesizedFindings.confidenceLevel === 'medium' ? 'warning' : 'secondary'}>
              {run.synthesizedFindings.confidenceLevel}
            </Badge>
          </div>

          {run.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Sources ({run.sources.length})</h4>
              <div className="space-y-2">
                {run.sources.map((source) => (
                  <div key={source.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {source.title}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <p className="text-xs text-muted-foreground">{source.domain}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {source.excerptOrSummary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface ResearchData {
  runs: ResearchRun[];
}

export default function ResearchPage() {
  const [category, setCategory] = useState<ResearchCategory | 'all'>('all');
  const { data, isLoading } = useSWR(
    '/api/research/runs',
    (path: string) => apiClient.get<ResearchData>(path),
  );

  const filteredRuns = data?.runs.filter(
    (r) => category === 'all' || r.query.category === category,
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              category === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No research runs yet. The agent will run research on the next cycle.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRuns.map((run) => (
            <ResearchRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
