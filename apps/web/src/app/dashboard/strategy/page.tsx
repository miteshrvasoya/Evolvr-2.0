'use client';

import { useStrategy } from '@/lib/hooks/use-strategy';
import { ContentMixChart } from '@/components/dashboard/content-mix-chart';
import { InsightCard } from '@/components/dashboard/insight-card';
import { ExperimentRow } from '@/components/dashboard/experiment-row';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatPercent } from '@/lib/utils';

export default function StrategyPage() {
  const { data, isLoading } = useStrategy();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { active, history, insights, experiments } = data;

  return (
    <div className="space-y-6">
      {/* Active Strategy */}
      {active ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Strategy v{active.versionNumber}</CardTitle>
                <CardDescription>Created {formatDate(active.createdAt)}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">Active</Badge>
                <Badge variant="outline">Confidence: {formatPercent(active.confidence)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{active.rationale}</p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold mb-3">Content Mix</h4>
                <ContentMixChart contentMix={active.contentMix} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3">Weekly Cadence Targets</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Reels', value: active.cadence.reelsPerWeek },
                    { label: 'Carousels', value: active.cadence.carouselsPerWeek },
                    { label: 'Stories', value: active.cadence.storiesPerWeek },
                    { label: 'Static Posts', value: active.cadence.staticPostsPerWeek },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(value / 7 * 100, 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm font-medium">{value}/wk</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Objective</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {active.objective.primaryMetric.replace(/_/g, ' ')}
                    {active.objective.targetGrowthRate
                      ? ` · Target growth: ${formatPercent(active.objective.targetGrowthRate)}`
                      : ''}
                  </p>
                  {active.objective.rationale && (
                    <p className="text-xs text-muted-foreground mt-1">{active.objective.rationale}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active strategy. The agent will create one on the next planning cycle.
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Strategic Insights ({insights.length})</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insights.filter((i) => i.status === 'active').map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Experiments */}
      {experiments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Experiments</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Name</th>
                  <th className="pb-2 text-left font-medium">Variable</th>
                  <th className="pb-2 text-left font-medium">Primary Metric</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => <ExperimentRow key={exp.id} experiment={exp} />)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategy History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-4 border-l">
              {history.filter((v) => v.status !== 'active').map((version) => (
                <div key={version.id} className="mb-4 last:mb-0">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-muted" />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">v{version.versionNumber}</span>
                    <Badge variant="secondary" className="text-xs capitalize">{version.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{version.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
