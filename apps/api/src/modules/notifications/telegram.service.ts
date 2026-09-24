/**
 * telegram.service.ts - Telegram notification delivery service.
 *
 * Design principles:
 *  - Idempotent: same idempotency_key is never sent twice
 *  - Non-blocking: callers are never blocked by Telegram API failures
 *  - Retry: up to 3 attempts with exponential backoff (1s, 4s, 16s)
 *  - Preference-aware: respects per-user telegram_enabled and per-event overrides
 *  - Audit: every delivery attempt is recorded in the notifications table
 *  - Secret-safe: BOT_TOKEN is never logged or included in messages
 */
import { sql } from '../../db/client.js';
import { env } from '../../config/env.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export const TELEGRAM_EVENT_TYPES = [
  'AGENT_STARTED',
  'AGENT_COMPLETED',
  'AGENT_PERMANENTLY_FAILED',
  'STRATEGY_GENERATED',
  'CONTENT_BATCH_GENERATED',
  'CONTENT_SCHEDULED',
  'MEDIA_GENERATION_FAILED',
  'WAITING_FOR_MEDIA',
  'MEDIA_UPLOADED',
  'PUBLISH_SUCCEEDED',
  'PUBLISH_FAILED_PERMANENT',
  'INSTAGRAM_SYNC_COMPLETED',
  'INSTAGRAM_AUTH_FAILURE',
  'PERFORMANCE_INSIGHT',
  'LEARNING_TRIGGERED',
] as const;

export type TelegramEventType = (typeof TELEGRAM_EVENT_TYPES)[number];

export interface TelegramSendParams {
  /** Canonical event type — used for preference checks and idempotency prefix */
  eventType: TelegramEventType;
  /** DB user ID — used to look up notification preferences */
  userId: string;
  /** Pre-formatted MarkdownV2 message body */
  message: string;
  /**
   * Opaque string uniquely identifying this logical event occurrence.
   * Format recommendation: tg:{EVENT_TYPE}:{entity_id}
   * If this key already exists in the notifications table, the send is skipped.
   */
  idempotencyKey: string;
  /** Dashboard deep-link for the action button (optional) */
  actionUrl?: string;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1_000, 4_000, 16_000];

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TelegramNotificationService {
  /**
   * Sends a Telegram message for the given event.
   *
   * This method is FIRE-AND-FORGET — it never throws. All errors are caught
   * internally and recorded in the notifications table. Agent workflows are
   * never blocked by Telegram API failures.
   */
  async send(params: TelegramSendParams): Promise<void> {
    // Run asynchronously without awaiting so callers are never blocked
    this._sendWithRetry(params).catch((err) => {
      console.error('[TelegramService] Unhandled error in fire-and-forget send:', err);
    });
  }

  /**
   * Synchronous variant that returns the final delivery status.
   * Use this in tests to assert behaviour without races.
   */
  async sendAndWait(params: TelegramSendParams): Promise<'sent' | 'failed' | 'skipped' | 'duplicate'> {
    return this._sendWithRetry(params);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async _sendWithRetry(
    params: TelegramSendParams,
  ): Promise<'sent' | 'failed' | 'skipped' | 'duplicate'> {
    const { eventType, userId, message, idempotencyKey, actionUrl } = params;

    // 1. Feature flag — skip entirely if Telegram is disabled globally
    if (!env.TELEGRAM_NOTIFICATIONS) {
      return 'skipped';
    }

    // 2. Idempotency check — skip if already sent
    const existing = await this._getExistingRecord(idempotencyKey);
    if (existing) {
      if (existing.telegram_status === 'sent') {
        return 'duplicate';
      }
      // If it previously failed, we will try again (the record will be updated)
    }

    // 3. Preference check — skip if user has disabled Telegram or this event type
    const shouldSend = await this._checkPreferences(userId, eventType);
    if (!shouldSend) {
      await this._upsertRecord({
        userId,
        eventType,
        message,
        idempotencyKey,
        actionUrl,
        status: 'skipped',
        telegramMessageId: null,
        error: null,
      });
      return 'skipped';
    }

    // 4. Validate credentials
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.warn('[TelegramService] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
      await this._upsertRecord({
        userId,
        eventType,
        message,
        idempotencyKey,
        actionUrl,
        status: 'failed',
        telegramMessageId: null,
        error: 'Telegram credentials not configured',
      });
      return 'failed';
    }

    // 5. Attempt delivery with exponential backoff
    let lastError = '';
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      try {
        const messageId = await this._callTelegramApi(message);
        // Success
        await this._upsertRecord({
          userId,
          eventType,
          message,
          idempotencyKey,
          actionUrl,
          status: 'sent',
          telegramMessageId: String(messageId),
          error: null,
        });
        return 'sent';
      } catch (err: any) {
        lastError = err?.message ?? String(err);
        const isLastAttempt = attempt === RETRY_DELAYS_MS.length - 1;
        if (!isLastAttempt) {
          const delay = RETRY_DELAYS_MS[attempt] ?? 1_000;
          console.warn(
            `[TelegramService] Attempt ${attempt + 1} failed for ${idempotencyKey}. Retrying in ${delay}ms. Error: ${lastError}`,
          );
          await sleep(delay);
        }
      }
    }

    // 6. All retries exhausted — record failure (never throw)
    console.error(
      `[TelegramService] All retries failed for ${idempotencyKey}. Last error: ${lastError}`,
    );
    await this._upsertRecord({
      userId,
      eventType,
      message,
      idempotencyKey,
      actionUrl,
      status: 'failed',
      telegramMessageId: null,
      error: lastError.slice(0, 500), // truncate — never store arbitrary long errors
    });
    return 'failed';
  }

  /** Makes a single HTTP request to the Telegram Bot API sendMessage endpoint. */
  protected async _callTelegramApi(message: string): Promise<number> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      // Never include the bot token in logs
      throw new Error(`Telegram API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = (await response.json()) as { ok: boolean; result: { message_id: number } };
    if (!data.ok) {
      throw new Error(`Telegram API returned ok=false`);
    }
    return data.result.message_id;
  }

  /**
   * Returns the existing notifications row for the given idempotency key, or null.
   */
  private async _getExistingRecord(idempotencyKey: string) {
    try {
      const rows = await sql`
        SELECT telegram_status FROM notifications
        WHERE idempotency_key = ${idempotencyKey}
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Reads notification_preferences for the user.
   * Defaults to enabled if no row exists.
   */
  private async _checkPreferences(userId: string, eventType: TelegramEventType): Promise<boolean> {
    try {
      const rows = await sql`
        SELECT telegram_enabled, telegram_event_overrides
        FROM notification_preferences
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      if (rows.length === 0) return true; // default: enabled

      const prefs = rows[0]!;
      // Check global switch
      if (!prefs.telegramEnabled) return false;

      // Check per-event override
      const overrides = (prefs.telegramEventOverrides ?? {}) as Record<string, boolean>;
      if (typeof overrides[eventType] === 'boolean') {
        return overrides[eventType]!;
      }
      return true;
    } catch {
      // On DB error, default to sending
      return true;
    }
  }

  /** UPSERTs a notifications row with Telegram delivery status. */
  private async _upsertRecord(params: {
    userId: string;
    eventType: TelegramEventType;
    message: string;
    idempotencyKey: string;
    actionUrl?: string;
    status: 'sent' | 'failed' | 'skipped' | 'duplicate';
    telegramMessageId: string | null;
    error: string | null;
  }): Promise<void> {
    try {
      const { userId, eventType, message, idempotencyKey, actionUrl, status, telegramMessageId, error } = params;
      const title = eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

      await sql`
        INSERT INTO notifications (
          user_id, type, priority, title, message, action_url,
          status, idempotency_key,
          telegram_status, telegram_message_id,
          telegram_sent_at, telegram_error
        ) VALUES (
          ${userId},
          ${'TELEGRAM_' + eventType},
          ${'medium'},
          ${title},
          ${message.slice(0, 1000)},
          ${actionUrl ?? null},
          ${'unread'},
          ${idempotencyKey},
          ${status},
          ${telegramMessageId},
          ${status === 'sent' ? new Date().toISOString() : null},
          ${error}
        )
        ON CONFLICT (idempotency_key) DO UPDATE SET
          telegram_status     = EXCLUDED.telegram_status,
          telegram_message_id = EXCLUDED.telegram_message_id,
          telegram_sent_at    = EXCLUDED.telegram_sent_at,
          telegram_error      = EXCLUDED.telegram_error
      `;
    } catch (err) {
      console.error('[TelegramService] Failed to upsert notification record:', err);
    }
  }
}

/** Singleton for use across workers */
export const telegramService = new TelegramNotificationService();
