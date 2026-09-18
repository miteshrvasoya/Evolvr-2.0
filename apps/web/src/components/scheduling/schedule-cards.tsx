'use client';

import { useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  Calendar, Clock, MapPin, Sparkles, CheckCircle2,
  Edit3, X, ChevronRight, AlertTriangle, Info,
  RefreshCw, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ScheduleRecommendation } from '@/lib/hooks/use-schedule';

// ─── ScheduleStatusBadge ──────────────────────────────────────────────────────

export function ScheduleStatusBadge({
  status,
  publishStatus,
}: {
  status?: string;
  publishStatus?: string;
}) {
  if (publishStatus === 'SUCCEEDED') {
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">✓ Published</Badge>;
  }
  if (publishStatus === 'PROCESSING') {
    return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse">⏳ Publishing…</Badge>;
  }
  if (publishStatus === 'FAILED' || publishStatus === 'ACTION_REQUIRED') {
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">✕ Publish Failed</Badge>;
  }
  if (publishStatus === 'RETRYING') {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">↺ Retrying</Badge>;
  }

  switch (status) {
    case 'SCHEDULED':  return <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30">⏰ Scheduled</Badge>;
    case 'SUGGESTED':  return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">💡 Recommended</Badge>;
    case 'MISSED':     return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">⚠ Missed</Badge>;
    case 'CANCELLED':  return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30">Cancelled</Badge>;
    default:           return null;
  }
}

// ─── MediaStatusBadge ─────────────────────────────────────────────────────────

export function MediaStatusBadge({ status }: { status?: string }) {
  if (status === 'READY') {
    return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" />Media Ready</span>;
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <AlertTriangle className="h-3 w-3" />Media Missing
    </span>
  );
}

// ─── ScheduleRecommendationCard ───────────────────────────────────────────────

interface RecommendationCardProps {
  recommendation: ScheduleRecommendation;
  alternatives?: ScheduleRecommendation['candidateWindows'];
  onAccept: (params: { scheduledAt: string; timezone: string; recommendationId: string }) => void;
  onChooseOther?: () => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
}

export function ScheduleRecommendationCard({
  recommendation,
  alternatives,
  onAccept,
  onChooseOther,
  onRegenerate,
  isLoading,
}: RecommendationCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const dt = DateTime.fromISO(recommendation.recommendedAt).setZone(recommendation.timezone);
  const dayLabel   = dt.toFormat('EEEE');
  const dateLabel  = dt.toFormat('d MMMM yyyy');
  const timeLabel  = dt.toFormat('h:mm a');
  const tzLabel    = recommendation.timezone;

  const signals = recommendation.supportingSignals?.filter(s => s.type !== 'spacing') ?? [];

  const handleAccept = () => {
    onAccept({
      scheduledAt: recommendation.recommendedAt,
      timezone: recommendation.timezone,
      recommendationId: recommendation.id,
    });
  };

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-500/10 bg-violet-500/5">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-violet-300">Recommended Publishing Time</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Recommended time */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{dayLabel}</p>
          <p className="text-2xl font-bold tracking-tight">{dateLabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="h-4 w-4 text-violet-400" />
            <span className="text-xl font-semibold text-violet-300">{timeLabel}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />{tzLabel}
            </span>
          </div>
        </div>

        {/* Why this time? */}
        {signals.length > 0 && (
          <div>
            <button
              onClick={() => setShowReasoning(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
              Why this time?
              <ChevronRight className={`h-3 w-3 transition-transform ${showReasoning ? 'rotate-90' : ''}`} />
            </button>
            {showReasoning && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-violet-500/20">
                {/* Full reasoning (Observation → Evidence → Recommendation) */}
                {recommendation.reasoningSummary && (
                  <div className="space-y-1.5">
                    {recommendation.reasoningSummary.split('\n\n').map((para, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">{para}</p>
                    ))}
                  </div>
                )}
                {/* Individual signals */}
                <ul className="space-y-1 mt-2">
                  {signals.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-violet-400 mt-0.5">•</span>
                      <span>{s.evidence || s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Alternative times */}
        {alternatives && alternatives.length > 1 && (
          <div>
            <button
              onClick={() => setShowAlternatives(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAlternatives ? 'Hide' : 'Show'} alternative times ({alternatives.length - 1})
            </button>
            {showAlternatives && (
              <div className="mt-2 space-y-1">
                {alternatives.slice(1, 4).map((alt, i) => {
                  const altDt = DateTime.fromISO(alt.scheduledAt).setZone(alt.timezone);
                  return (
                    <button
                      key={i}
                      onClick={() => onAccept({ scheduledAt: alt.scheduledAt, timezone: alt.timezone, recommendationId: recommendation.id })}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-xs text-left"
                    >
                      <span>{altDt.toFormat("EEE d MMM · h:mm a")}</span>
                      <span className="text-muted-foreground">{alt.timezone}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isLoading}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
          >
            {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
            Accept Schedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onChooseOther}
            disabled={isLoading}
          >
            <Edit3 className="h-3.5 w-3.5 mr-1.5" />
            Choose Time
          </Button>
          {onRegenerate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              disabled={isLoading}
              title="Generate new recommendation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ActiveSchedulePanel ──────────────────────────────────────────────────────

interface ActiveSchedulePanelProps {
  schedule: {
    id: string;
    scheduledAt: string;
    scheduleTimezone: string;
    scheduleStatus: string;
    publishJob?: {
      status: string;
      errorCode?: string;
      lastErrorMessage?: string;
      attempts: number;
      nextRetryAt?: string;
      platformPostId?: string;
    };
  };
  mediaStatus?: string | null;
  onEdit?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  onRetryPublish?: () => void;
  isLoading?: boolean;
}

export function ActiveSchedulePanel({
  schedule,
  mediaStatus,
  onEdit,
  onReschedule,
  onCancel,
  onRetryPublish,
  isLoading,
}: ActiveSchedulePanelProps) {
  const dt = DateTime.fromISO(schedule.scheduledAt).setZone(schedule.scheduleTimezone);
  const isPast = dt.toJSDate() < new Date();
  const pj = schedule.publishJob;

  const isMissed   = schedule.scheduleStatus === 'MISSED';
  const isCancelled = schedule.scheduleStatus === 'CANCELLED';
  const isPublished = pj?.status === 'SUCCEEDED';
  const isFailed    = pj?.status === 'FAILED' || pj?.status === 'ACTION_REQUIRED';
  const isRetrying  = pj?.status === 'RETRYING';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Status bar */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${
        isPublished ? 'bg-emerald-500/10 border-b border-emerald-500/20' :
        isFailed    ? 'bg-red-500/10 border-b border-red-500/20' :
        isMissed    ? 'bg-amber-500/10 border-b border-amber-500/20' :
                      'bg-muted/30 border-b border-border'
      }`}>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Schedule</span>
        </div>
        <ScheduleStatusBadge status={schedule.scheduleStatus} publishStatus={pj?.status} />
      </div>

      <div className="p-4 space-y-4">
        {/* Date/time */}
        <div>
          <p className="text-xl font-bold">{dt.toFormat("d MMM yyyy")}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{dt.toFormat("h:mm a")}</span>
            <span className="text-xs text-muted-foreground">{schedule.scheduleTimezone}</span>
            {isPast && !isPublished && <span className="text-xs text-amber-400">(past)</span>}
          </div>
        </div>

        {/* Media status */}
        <MediaStatusBadge status={mediaStatus ?? undefined} />

        {/* Failure info */}
        {isFailed && pj && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs space-y-1">
            <p className="font-semibold text-red-400">Publishing Failed</p>
            {pj.errorCode && <p className="text-muted-foreground">Code: {pj.errorCode}</p>}
            {pj.lastErrorMessage && <p className="text-red-300/80">{pj.lastErrorMessage}</p>}
            {pj.attempts > 0 && <p className="text-muted-foreground">Attempt {pj.attempts} of 5</p>}
          </div>
        )}

        {isRetrying && pj?.nextRetryAt && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
            <p className="font-semibold text-amber-400">Retrying…</p>
            <p className="text-muted-foreground mt-0.5">
              Next attempt: {DateTime.fromISO(pj.nextRetryAt).toRelative()}
            </p>
          </div>
        )}

        {isMissed && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
            <p className="font-semibold text-amber-400">Schedule Missed</p>
            <p className="text-muted-foreground mt-0.5">Required media was unavailable at scheduled time.</p>
          </div>
        )}

        {/* Success info */}
        {isPublished && pj?.platformPostId && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs">
            <p className="font-semibold text-emerald-400">✓ Published Successfully</p>
            <p className="text-muted-foreground mt-0.5">Instagram Post ID: {pj.platformPostId}</p>
          </div>
        )}

        {/* Actions */}
        {!isPublished && !isCancelled && (
          <div className="flex flex-wrap gap-2">
            {isMissed || isFailed ? (
              <>
                {isFailed && onRetryPublish && (
                  <Button size="sm" variant="outline" onClick={onRetryPublish} disabled={isLoading}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry
                  </Button>
                )}
                {onReschedule && (
                  <Button size="sm" variant="outline" onClick={onReschedule} disabled={isLoading}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reschedule
                  </Button>
                )}
              </>
            ) : (
              <>
                {onEdit && (
                  <Button size="sm" variant="outline" onClick={onEdit} disabled={isLoading}>
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />Edit
                  </Button>
                )}
                {onCancel && (
                  <Button size="sm" variant="ghost" onClick={onCancel} disabled={isLoading}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5 mr-1.5" />Cancel
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ScheduleVersionHistory ───────────────────────────────────────────────────

export function ScheduleVersionHistory({ versions }: { versions: any[] }) {
  if (!versions?.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule History</p>
      <div className="space-y-1.5">
        {versions.map((v) => {
          const dt = DateTime.fromISO(v.scheduledAt).setZone(v.timezone);
          return (
            <div key={v.version} className="flex items-start gap-3 text-xs">
              <span className="text-muted-foreground mt-0.5 w-12 shrink-0">v{v.version}</span>
              <div className="flex-1">
                <p className="font-medium">{dt.toFormat("d MMM · h:mm a")} <span className="text-muted-foreground">{v.timezone}</span></p>
                <p className="text-muted-foreground">{v.reason} · {v.actor} · {v.source}</p>
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${
                v.scheduleStatus === 'CANCELLED' ? 'opacity-50' : ''
              }`}>
                {v.scheduleStatus}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
