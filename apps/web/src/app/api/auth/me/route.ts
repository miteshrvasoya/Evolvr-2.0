import { type NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('localhost', '127.0.0.1');

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json() as unknown;
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error('Me route error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) } }, { status: 500 });
  }
}
