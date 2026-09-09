'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@evolvr/types';

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const fetcher = (path: string) => apiClient.get<NotificationsResponse>(path);

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/notifications',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  async function markRead(id: string) {
    await apiClient.patch(`/api/notifications/${id}/read`);
    await mutate();
  }

  async function markAllRead() {
    await apiClient.post('/api/notifications/read-all');
    await mutate();
  }

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    error,
    isLoading,
    markRead,
    markAllRead,
    refresh: mutate,
  };
}
