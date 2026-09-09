// ── Typed API Client ──────────────────────────────────────────────────────────
// All dashboard API calls go through this module.
// On the client side, reads the auth token from cookie.
// On the server side, reads from the request headers forwarded by Next.js.

import type { ApiResponse } from '@evolvr/types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('localhost', '127.0.0.1');

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match?.[1];
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  serverToken?: string,
): Promise<T> {
  const token = serverToken ?? getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(
      json.error.code,
      json.error.message,
      res.status,
    );
  }

  return json.data;
}

export const apiClient = {
  get<T>(path: string, serverToken?: string) {
    return request<T>('GET', path, undefined, serverToken);
  },
  post<T>(path: string, body?: unknown, serverToken?: string) {
    return request<T>('POST', path, body, serverToken);
  },
  put<T>(path: string, body?: unknown, serverToken?: string) {
    return request<T>('PUT', path, body, serverToken);
  },
  patch<T>(path: string, body?: unknown, serverToken?: string) {
    return request<T>('PATCH', path, body, serverToken);
  },
  delete<T>(path: string, serverToken?: string) {
    return request<T>('DELETE', path, undefined, serverToken);
  },
};
