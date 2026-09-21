/**
 * telegram.service.test.ts
 *
 * Tests for TelegramNotificationService covering:
 *  1. Successful delivery
 *  2. Duplicate prevention (idempotency)
 *  3. API failure + retry (succeeds on 3rd attempt)
 *  4. Permanent API failure - all retries exhausted, no throw
 *  5. Preference: telegram_enabled = false -> skipped
 *  6. Preference: per-event override = false -> skipped for that event
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks (must use inline factories to avoid vi.mock hoisting issues) ---

// Mutable mock state, controlled per-test
const _db = { calls: [] as any[], responses: [] as any[] };

vi.mock('../../../db/client.js', () => {
  // A tagged-template-function that returns the next pre-queued response
  const sqlMock: any = function sqlMock() {
    const r = _db.responses.shift();
    _db.calls.push(1);
    return Promise.resolve(r ?? []);
  };
  sqlMock.json = (v: any) => v;
  // Support chaining: sql`...`.json -> just return identity
  return { sql: new Proxy(sqlMock, {
    get: (t, prop) => prop === 'json' ? (v: any) => v : t[prop],
  }) };
});

vi.mock('../../../config/env.js', () => ({
  env: {
    TELEGRAM_NOTIFICATIONS: true,
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_CHAT_ID: '123456',
    EVOLVR_DASHBOARD_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));

// --- Import AFTER mocks are set up ---
import { TelegramNotificationService } from '../telegram.service.js';

// --- Testable subclass ---
class TestableService extends TelegramNotificationService {
  public apiCallCount = 0;
  public apiResponses: Array<{ success: boolean; messageId?: number; error?: string }> = [];

  protected override async _callTelegramApi(_message: string): Promise<number> {
    const response = this.apiResponses[this.apiCallCount];
    this.apiCallCount++;
    if (!response || !response.success) {
      throw new Error(response?.error ?? 'Simulated Telegram API error');
    }
    return response.messageId ?? 42;
  }
}

// --- Base params ---
const BASE_PARAMS = {
  eventType: 'PUBLISH_SUCCEEDED' as const,
  userId: 'user-uuid-1',
  message: 'Test message',
  idempotencyKey: 'tg:PUBLISH_SUCCEEDED:post-uuid-1',
  actionUrl: 'http://localhost:3000/dashboard/content',
};

// --- DB response helpers ---

function queueDb(responses: any[]) {
  _db.responses.push(...responses);
}

function freshDb() {
  // no existing record, no prefs, upsert succeeds
  queueDb([[], [], [{ id: 'notif-1' }]]);
}

// --- Tests ---

describe('TelegramNotificationService', () => {
  let service: TestableService;

  beforeEach(() => {
    service = new TestableService();
    _db.calls = [];
    _db.responses = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _db.calls = [];
    _db.responses = [];
  });

  // 1. Successful delivery
  it('sends message and records sent status on success', async () => {
    freshDb();
    service.apiResponses = [{ success: true, messageId: 42 }];

    const result = await service.sendAndWait(BASE_PARAMS);

    expect(result).toBe('sent');
    expect(service.apiCallCount).toBe(1);
    expect(_db.calls.length).toBe(3); // idempotency check + prefs + upsert
  });

  // 2. Duplicate prevention
  it('returns duplicate and skips API call when already sent', async () => {
    queueDb([[{ telegram_status: 'sent' }]]); // existing record with status=sent
    service.apiResponses = [{ success: true, messageId: 99 }];

    const result = await service.sendAndWait(BASE_PARAMS);

    expect(result).toBe('duplicate');
    expect(service.apiCallCount).toBe(0);
    expect(_db.calls.length).toBe(1); // only the idempotency check
  });

  // 3. Retry: fails twice, succeeds on 3rd attempt
  it('retries on transient failure and succeeds', async () => {
    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 as any; });
    freshDb();
    service.apiResponses = [
      { success: false, error: 'Network timeout' },
      { success: false, error: 'Network timeout' },
      { success: true, messageId: 77 },
    ];

    const result = await service.sendAndWait(BASE_PARAMS);

    expect(result).toBe('sent');
    expect(service.apiCallCount).toBe(3);
  });

  // 4. Permanent failure - all retries exhausted, never throws
  it('records failed status after all retries without throwing', async () => {
    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 as any; });
    freshDb();
    service.apiResponses = [
      { success: false, error: 'Rate limited' },
      { success: false, error: 'Rate limited' },
      { success: false, error: 'Rate limited' },
    ];

    let threw = false;
    let result: string | undefined;
    try {
      result = await service.sendAndWait(BASE_PARAMS);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBe('failed');
    expect(service.apiCallCount).toBe(3);
    // upsert must have been called to record failure
    expect(_db.calls.length).toBe(3);
  });

  // 5. Global preference disabled
  it('skips when user globally disables Telegram', async () => {
    queueDb([
      [],  // no existing record
      [{ telegramEnabled: false, telegramEventOverrides: {} }], // prefs: disabled
      [{ id: 'notif-skip' }], // upsert skipped record
    ]);
    service.apiResponses = [{ success: true, messageId: 1 }];

    const result = await service.sendAndWait(BASE_PARAMS);

    expect(result).toBe('skipped');
    expect(service.apiCallCount).toBe(0);
  });

  // 6. Per-event override disabled
  it('skips when per-event override disables this event type', async () => {
    queueDb([
      [],  // no existing record
      [{ telegramEnabled: true, telegramEventOverrides: { PUBLISH_SUCCEEDED: false } }],
      [{ id: 'notif-skip' }],
    ]);
    service.apiResponses = [{ success: true, messageId: 2 }];

    const result = await service.sendAndWait(BASE_PARAMS);

    expect(result).toBe('skipped');
    expect(service.apiCallCount).toBe(0);
  });
});
