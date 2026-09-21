'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

const fetcherRaw = (url: string) => apiClient.getRaw<any>(url);

export function useNeedsAttentionCount() {
  const { data } = useSWR('/api/content/ideas?assetStatus=failed&limit=1', fetcherRaw, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const count = (data as any)?.total ?? 0;

  return { count };
}
