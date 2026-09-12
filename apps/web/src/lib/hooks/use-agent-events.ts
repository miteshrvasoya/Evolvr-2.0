'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface AgentEventItem {
  id: string;
  runId: string;
  stepId: string | null;
  eventType: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('localhost', '127.0.0.1');

function getToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match?.[1];
}

export function useAgentEvents(runId: string | null | undefined) {
  const [events, setEvents]               = useState<AgentEventItem[]>([]);
  const [connectionState, setConnState]   = useState<ConnectionState>('disconnected');
  const [isRunComplete, setIsRunComplete] = useState(false);

  const lastEventIdRef  = useRef<string | null>(null);
  const esRef           = useRef<EventSource | null>(null);
  const retryCountRef   = useRef(0);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef      = useRef(true);

  // Fetch missed events since lastEventId (called on reconnect)
  const fetchMissedEvents = useCallback(async () => {
    if (!runId || !lastEventIdRef.current) return;
    try {
      const data = await apiClient.get<{ events: AgentEventItem[] }>(
        `/api/agent/runs/${runId}/events?afterId=${lastEventIdRef.current}`
      );
      const evts = data?.events;
      if (evts && evts.length > 0) {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const fresh = evts.filter(e => !existingIds.has(e.id));
          return [...prev, ...fresh];
        });
        lastEventIdRef.current = evts[evts.length - 1]?.id ?? lastEventIdRef.current;
      }
    } catch {
      // Silently ignore — the stream will catch up
    }
  }, [runId]);

  const connect = useCallback(() => {
    if (!runId || !mountedRef.current) return;

    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const token = getToken();
    const params = new URLSearchParams();
    if (lastEventIdRef.current) params.set('lastEventId', lastEventIdRef.current);
    if (token) params.set('token', token);

    const url = `${BASE_URL}/api/agent/runs/${runId}/stream?${params.toString()}`;
    setConnState('connecting');

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('agent.event', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const evt: AgentEventItem = JSON.parse(e.data);
        lastEventIdRef.current = evt.id;
        setEvents(prev => {
          if (prev.some(p => p.id === evt.id)) return prev;
          return [...prev, evt];
        });
        retryCountRef.current = 0; // reset back-off on success
      } catch {/* ignore parse errors */}
    });

    es.addEventListener('agent.completed', () => {
      if (!mountedRef.current) return;
      setIsRunComplete(true);
      setConnState('disconnected');
      es.close();
    });

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnState('connected');
      retryCountRef.current = 0;
      // Fetch any events missed during reconnect gap
      fetchMissedEvents();
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      esRef.current = null;

      if (isRunComplete) return;

      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current++;
      setConnState('reconnecting');

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [runId, fetchMissedEvents, isRunComplete]);

  useEffect(() => {
    mountedRef.current = true;
    if (runId) {
      setEvents([]);
      setIsRunComplete(false);
      retryCountRef.current = 0;
      connect();
    }
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return { events, connectionState, isRunComplete, lastEventId: lastEventIdRef.current };
}
