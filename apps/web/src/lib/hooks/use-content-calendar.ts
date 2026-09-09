'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { Post, ContentIdea } from '@evolvr/types';

interface CalendarData {
  scheduled: Post[];
  published: Post[];
  failed: Post[];
  awaitingReview: Post[];
  ideas: Record<string, ContentIdea>;
}

const fetcher = (path: string) => apiClient.get<CalendarData>(path);

export function useContentCalendar() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/content/calendar',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  async function approvePost(postId: string) {
    await apiClient.post(`/api/content/posts/${postId}/approve`);
    await mutate();
  }

  async function rejectPost(postId: string, reason: string) {
    await apiClient.post(`/api/content/posts/${postId}/reject`, { reason });
    await mutate();
  }

  return {
    data,
    error,
    isLoading,
    approvePost,
    rejectPost,
    refresh: mutate,
  };
}
