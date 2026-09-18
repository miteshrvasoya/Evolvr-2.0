/**
 * use-schedule.ts
 *
 * React hooks for the scheduling system.
 * All hooks follow SWR-style loading/error/mutate patterns.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleRecommendation {
  id: string;
  contentIdeaId: string;
  accountId: string;
  recommendedAt: string;
  timezone: string;
  reasoningSummary: string;
  supportingSignals: Array<{ type: string; label: string; evidence: string }>;
  candidateWindows: Array<{
    scheduledAt: string;
    timezone: string;
    localLabel: string;
    score: number;
    signals: string[];
  }>;
  status: 'SUGGESTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
  createdAt: string;
}

export interface ScheduleData {
  id: string;
  contentIdeaId: string;
  socialAccountId: string;
  scheduledAt: string;
  scheduleTimezone: string;
  scheduleStatus: 'SCHEDULED' | 'SUGGESTED' | 'MISSED' | 'CANCELLED';
  status: string;
  publishJobId?: string;
  publishJob?: {
    id: string;
    status: string;
    errorCode?: string;
    lastErrorMessage?: string;
    attempts: number;
    nextRetryAt?: string;
    platformPostId?: string;
  };
  versions?: Array<{
    version: number;
    scheduledAt: string;
    timezone: string;
    source: string;
    reason: string;
    actor: string;
    createdAt: string;
  }>;
  recommendationId?: string;
  // Joined fields
  hook?: string;
  pillar?: string;
  format?: string;
  mediaUrl?: string;
  mediaStatus?: string;
}

export interface SchedulingPreferences {
  accountId?: string;
  timezone: string;
  postingFrequency: { type: 'per_week' | 'per_day'; value: number };
  preferredWindows: Array<{ label: string; start: string; end: string }>;
  minGapHours: number;
  maxPostsPerDay: number;
}

// ─── useContentSchedule ───────────────────────────────────────────────────────
// Get/set the schedule for a specific content idea

export function useContentSchedule(contentIdeaId: string | undefined) {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [recommendations, setRecommendations] = useState<ScheduleRecommendation[]>([]);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!contentIdeaId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<any>(`/api/content/ideas/${contentIdeaId}/schedule`);
      setSchedule(data.schedule);
      setRecommendations(data.recommendations ?? []);
      setMediaStatus(data.mediaStatus);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  }, [contentIdeaId]);

  useEffect(() => { fetch(); }, [fetch]);

  const generateRecommendation = useCallback(async () => {
    if (!contentIdeaId) return;
    setIsLoading(true);
    setError(null);
    try {
      const rec = await apiClient.post<ScheduleRecommendation>(
        `/api/content/ideas/${contentIdeaId}/schedule/recommend`
      );
      setRecommendations(prev => [rec, ...prev]);
      return rec;
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate recommendation');
    } finally {
      setIsLoading(false);
    }
  }, [contentIdeaId]);

  const acceptSchedule = useCallback(async (params: {
    scheduledAt: string;
    timezone: string;
    recommendationId?: string;
    reason?: string;
  }) => {
    if (!contentIdeaId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<any>(
        `/api/content/ideas/${contentIdeaId}/schedule`,
        params
      );
      await fetch();
      return result;
    } catch (err: any) {
      setError(err.message ?? 'Failed to create schedule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [contentIdeaId, fetch]);

  const editSchedule = useCallback(async (postId: string, params: {
    scheduledAt: string;
    timezone: string;
    reason?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.patch<any>(`/api/schedules/${postId}`, params);
      await fetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to edit schedule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetch]);

  const cancelSchedule = useCallback(async (postId: string, reason?: string) => {
    setIsLoading(true);
    try {
      await apiClient.post(`/api/schedules/${postId}/cancel`, { reason });
      await fetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to cancel schedule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetch]);

  const reschedule = useCallback(async (postId: string, params: {
    scheduledAt: string;
    timezone: string;
    reason?: string;
  }) => {
    setIsLoading(true);
    try {
      await apiClient.post(`/api/schedules/${postId}/reschedule`, params);
      await fetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to reschedule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetch]);

  const retryPublish = useCallback(async (postId: string) => {
    try {
      await apiClient.post(`/api/schedules/${postId}/retry-publish`);
      await fetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to retry publish');
      throw err;
    }
  }, [fetch]);

  return {
    schedule,
    recommendations,
    mediaStatus,
    isLoading,
    error,
    refresh: fetch,
    generateRecommendation,
    acceptSchedule,
    editSchedule,
    cancelSchedule,
    reschedule,
    retryPublish,
  };
}

// ─── useScheduleCalendar ──────────────────────────────────────────────────────

export function useScheduleCalendar(year: number, month: number) {
  const [data, setData] = useState<ScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    apiClient.get<ScheduleData[]>(`/api/schedules/calendar?year=${year}&month=${month}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [year, month]);

  return { data, isLoading };
}

// ─── useUpcomingSchedules ─────────────────────────────────────────────────────

export function useUpcomingSchedules(limit = 10) {
  const [data, setData] = useState<ScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiClient.get<ScheduleData[]>(`/api/schedules/upcoming?limit=${limit}`);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, isLoading, refresh };
}

// ─── useScheduleStats ─────────────────────────────────────────────────────────

export function useScheduleStats() {
  const [data, setData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    apiClient.get<Record<string, number>>('/api/schedules/stats')
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading };
}

// ─── useSchedulingPreferences ─────────────────────────────────────────────────

export function useSchedulingPreferences() {
  const [prefs, setPrefs] = useState<SchedulingPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<SchedulingPreferences>('/api/scheduling/preferences');
      setPrefs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (updates: Partial<SchedulingPreferences>) => {
    setIsSaving(true);
    setError(null);
    try {
      const data = await apiClient.put<SchedulingPreferences>('/api/scheduling/preferences', updates);
      setPrefs(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save preferences');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { prefs, isLoading, isSaving, error, refresh: fetch, save };
}

// ─── useScheduleHistory ───────────────────────────────────────────────────────

export function useScheduleHistory(postId: string | undefined) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setIsLoading(true);
    apiClient.get<any[]>(`/api/schedules/${postId}/history`)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [postId]);

  return { history, isLoading };
}
