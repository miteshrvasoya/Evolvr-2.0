import { type NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('localhost', '127.0.0.1');

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email: string; password: string };

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as { success: boolean; data?: { token: string; user: unknown }; error?: { code: string; message: string } };

    if (!res.ok || !json.success) {
      return NextResponse.json(
        { error: json.error ?? { code: 'AUTH_ERROR', message: 'Login failed' } },
        { status: res.status },
      );
    }

    const token = json.data?.token;
    if (!token) {
      return NextResponse.json({ error: { code: 'NO_TOKEN', message: 'No token returned' } }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, user: json.data?.user });
    response.cookies.set('auth_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error in Next.js route:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) } },
      { status: 500 },
    );
  }
}
