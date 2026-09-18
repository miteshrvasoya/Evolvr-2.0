/**
 * SchedulingService
 *
 * Pure deterministic scheduling logic — no LLM calls.
 * Handles: candidate window generation, conflict detection, timezone
 * conversion, schedule CRUD, publish-job creation, and pre-publish validation.
 *
 * Timezone arithmetic uses luxon for correct DST handling.
 */
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { sql } from '../../db/client.js';
import { queues } from '../../queues/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CandidateWindow {
  scheduledAt: Date;           // UTC
  timezone: string;            // IANA
  localLabel: string;          // e.g. "Thursday 25 Sep · 7:30 PM"
  score: number;               // 0–1, higher = better match with available signals
  signals: string[];           // Short human-readable evidence bullets
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CreateScheduleResult {
  postId: string;
  scheduledAt: Date;
  timezone: string;
  publishJobId: string;
  bullmqJobId: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  timezone: 'UTC',
  postingFrequency: { type: 'per_week', value: 5 },
  preferredWindows: [
    { label: 'morning',   start: '08:00', end: '10:00' },
    { label: 'afternoon', start: '12:00', end: '14:00' },
    { label: 'evening',   start: '18:00', end: '21:00' },
  ],
  minGapHours: 4,
  maxPostsPerDay: 2,
};

// ─── SchedulingService ────────────────────────────────────────────────────────

export class SchedulingService {

  // ── Preferences ─────────────────────────────────────────────────────────────

  async getPreferences(accountId: string) {
    const rows = await sql`
      SELECT * FROM scheduling_preferences WHERE account_id = ${accountId}
    `;
    if (rows.length > 0) return rows[0];

    // Return defaults without persisting (no side-effects on read)
    return {
      accountId,
      ...DEFAULT_PREFS,
    };
  }

  async upsertPreferences(accountId: string, prefs: Partial<typeof DEFAULT_PREFS>) {
    // Also sync timezone to social_accounts for consistency
    if (prefs.timezone) {
      await sql`
        UPDATE social_accounts SET timezone = ${prefs.timezone}, updated_at = NOW()
        WHERE id = ${accountId}
      `;
    }

    const existing = await sql`
      SELECT id FROM scheduling_preferences WHERE account_id = ${accountId}
    `;

    if (existing.length === 0) {
      const merged = { ...DEFAULT_PREFS, ...prefs };
      await sql`
        INSERT INTO scheduling_preferences (
          account_id, timezone, posting_frequency, preferred_windows,
          min_gap_hours, max_posts_per_day
        ) VALUES (
          ${accountId},
          ${merged.timezone},
          ${sql.json(merged.postingFrequency)},
          ${sql.json(merged.preferredWindows)},
          ${merged.minGapHours},
          ${merged.maxPostsPerDay}
        )
      `;
    } else {
      await sql`
        UPDATE scheduling_preferences
        SET
          timezone          = COALESCE(${prefs.timezone ?? null}, timezone),
          posting_frequency = COALESCE(${prefs.postingFrequency ? sql.json(prefs.postingFrequency) : null}, posting_frequency),
          preferred_windows = COALESCE(${prefs.preferredWindows ? sql.json(prefs.preferredWindows) : null}, preferred_windows),
          min_gap_hours     = COALESCE(${prefs.minGapHours ?? null}, min_gap_hours),
          max_posts_per_day = COALESCE(${prefs.maxPostsPerDay ?? null}, max_posts_per_day),
          updated_at        = NOW()
        WHERE account_id = ${accountId}
      `;
    }

    return this.getPreferences(accountId);
  }

  // ── Candidate Window Generation ──────────────────────────────────────────────

  /**
   * Generates up to `maxCandidates` ranked candidate publishing windows.
   * Uses only data that actually exists — never fabricates signals.
   */
  async getCandidateWindows(
    accountId: string,
    contentIdeaId: string,
    maxCandidates = 5,
  ): Promise<CandidateWindow[]> {
    const prefs = await this.getPreferences(accountId);
    const tz = (prefs?.timezone ?? 'UTC') as string;

    // Fetch time-window performance data (hours with above-median engagement)
    const timeWindowPerf = await sql`
      SELECT
        EXTRACT(HOUR FROM p.published_at AT TIME ZONE ${tz}) AS local_hour,
        AVG(pm.engagement_rate) AS avg_engagement_rate,
        COUNT(p.id)::int AS count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      WHERE p.social_account_id = ${accountId}
        AND p.published_at IS NOT NULL
      GROUP BY local_hour
      ORDER BY avg_engagement_rate DESC
    `;

    // Compute median engagement rate for comparison
    const rates = timeWindowPerf.map((r: any) => Number(r.avgEngagementRate || 0));
    const medianRate = rates.length > 0
      ? rates.sort((a, b) => a - b)[Math.floor(rates.length / 2)] ?? 0
      : 0;

    const highEngagementHours = new Set(
      timeWindowPerf
        .filter((r: any) => Number(r.avgEngagementRate || 0) >= medianRate && Number(r.count) >= 2)
        .map((r: any) => Number(r.localHour))
    );

    // Fetch content idea for context
    const ideas = await sql`
      SELECT pillar, format, concept FROM content_ideas WHERE id = ${contentIdeaId}
    `;
    const idea = ideas[0];

    // Build preferred time slots from preferences
    const windows = (prefs?.preferredWindows ?? []) as Array<{ label: string; start: string; end: string }>;

    // Generate candidate slots over the next 7 days
    const now = DateTime.now().setZone(tz);
    const candidates: CandidateWindow[] = [];

    for (let dayOffset = 0; dayOffset <= 6 && candidates.length < maxCandidates * 3; dayOffset++) {
      const day = now.plus({ days: dayOffset });

      for (const window of windows) {
        const [startH = 8, startM = 0] = window.start.split(':').map(Number);
        const [endH = 20, endM = 0]     = window.end.split(':').map(Number);
        const midHour = Math.floor((startH + endH) / 2);
        const midMin  = Math.floor(((startM ?? 0) + (endM ?? 0)) / 2);

        const candidate = day.set({ hour: midHour, minute: midMin, second: 0, millisecond: 0 });

        // Must be in the future (at least 30 minutes)
        if (candidate.toUTC().toJSDate() <= new Date(Date.now() + 30 * 60 * 1000)) continue;

        // Conflict check
        const conflict = await this.detectConflicts(
          accountId,
          candidate.toUTC().toJSDate(),
          prefs?.minGapHours ?? 4,
        );
        if (conflict) continue;

        // Max posts/day check
        const postsOnDay = await this.countPostsOnDay(accountId, candidate.toUTC().toJSDate(), tz);
        if (postsOnDay >= (prefs.maxPostsPerDay ?? 2)) continue;

        // Score: prefer high-engagement hours
        let score = 0.5;
        const signals: string[] = [];

        if (highEngagementHours.has(midHour)) {
          score += 0.3;
          signals.push(`${window.label} window shows above-median engagement in account history`);
        }

        if (idea?.pillar) {
          signals.push(`Content pillar: ${idea.pillar}`);
        }

        if (timeWindowPerf.length < 3) {
          signals.push('Limited historical data — recommendation based on configured preferences');
        }

        const localLabel = candidate.toFormat("EEEE d MMM · h:mm a");

        candidates.push({
          scheduledAt: candidate.toUTC().toJSDate(),
          timezone: tz,
          localLabel,
          score,
          signals,
        });
      }
    }

    // Sort by score desc, deduplicate by date proximity (>= 2h apart)
    const sorted = candidates.sort((a, b) => b.score - a.score);
    const deduplicated: CandidateWindow[] = [];
    for (const c of sorted) {
      const tooClose = deduplicated.some(
        d => Math.abs(c.scheduledAt.getTime() - d.scheduledAt.getTime()) < 2 * 3600 * 1000
      );
      if (!tooClose) deduplicated.push(c);
      if (deduplicated.length >= maxCandidates) break;
    }

    return deduplicated;
  }

  // ── Conflict Detection ───────────────────────────────────────────────────────

  async detectConflicts(
    accountId: string,
    proposedAt: Date,
    minGapHours: number,
  ): Promise<boolean> {
    const gapMs = minGapHours * 3600 * 1000;
    const lower = new Date(proposedAt.getTime() - gapMs);
    const upper = new Date(proposedAt.getTime() + gapMs);

    const conflicts = await sql`
      SELECT id FROM posts
      WHERE social_account_id = ${accountId}
        AND schedule_status IN ('SCHEDULED', 'SUGGESTED')
        AND scheduled_at BETWEEN ${lower.toISOString()} AND ${upper.toISOString()}
      LIMIT 1
    `;
    return conflicts.length > 0;
  }

  async countPostsOnDay(accountId: string, date: Date, timezone: string): Promise<number> {
    const dt = DateTime.fromJSDate(date).setZone(timezone);
    const dayStart = dt.startOf('day').toUTC().toISO();
    const dayEnd   = dt.endOf('day').toUTC().toISO();

    const result = await sql`
      SELECT COUNT(*)::int AS c FROM posts
      WHERE social_account_id = ${accountId}
        AND schedule_status IN ('SCHEDULED')
        AND scheduled_at BETWEEN ${dayStart} AND ${dayEnd}
    `;
    return Number(result[0]?.c ?? 0);
  }

  // ── Schedule Readiness Validation ────────────────────────────────────────────

  /**
   * Full pre-scheduling validation. Must pass before a schedule is created.
   */
  async validateForScheduling(
    contentIdeaId: string,
    accountId: string,
    proposedAt: Date,
  ): Promise<ScheduleValidationResult> {
    const errors: string[] = [];

    // 1. Content exists and is owned by account
    const ideas = await sql`
      SELECT id, status, caption FROM content_ideas
      WHERE id = ${contentIdeaId} AND social_account_id = ${accountId}
    `;
    if (!ideas.length) {
      errors.push('Content not found or not accessible');
      return { valid: false, errors };
    }
    const idea = ideas[0];
    if (idea.status === 'blocked')    errors.push('Content is blocked by policy');
    if (idea.status === 'cancelled')  errors.push('Content is cancelled');

    // 2. Caption/content is present
    if (!idea.caption?.trim()) errors.push('Caption is required before scheduling');

    // 3. Media requirement exists and is READY (media may still be missing — allowed for scheduling)
    //    We warn but do not block — media can be uploaded after scheduling
    const mediaReq = await sql`
      SELECT status FROM media_requirements WHERE content_idea_id = ${contentIdeaId} LIMIT 1
    `;
    // Note: WAITING_FOR_MEDIA is allowed at schedule time; blocked at publish time

    // 4. No active schedule already exists
    const existingSchedule = await sql`
      SELECT id FROM posts
      WHERE content_idea_id = ${contentIdeaId}
        AND schedule_status IN ('SCHEDULED', 'SUGGESTED')
      LIMIT 1
    `;
    if (existingSchedule.length > 0) {
      errors.push('Content already has an active schedule. Cancel or reschedule the existing one.');
    }

    // 5. Instagram account is connected
    const account = await sql`
      SELECT connection_status, access_token_encrypted, token_expires_at
      FROM social_accounts WHERE id = ${accountId}
    `;
    if (!account.length) {
      errors.push('Social account not found');
    } else {
      const acc = account[0];
      if (acc.connectionStatus !== 'connected') {
        errors.push(`Instagram account is not connected (status: ${acc.connectionStatus})`);
      }
      if (!acc.accessTokenEncrypted) {
        errors.push('Instagram access token is missing. Reconnect your account.');
      }
      if (acc.tokenExpiresAt && new Date(acc.tokenExpiresAt) < new Date()) {
        errors.push('Instagram access token has expired. Reconnect your account.');
      }
    }

    // 6. Proposed time is in the future
    if (proposedAt <= new Date(Date.now() + 60_000)) {
      errors.push('Scheduled time must be at least 1 minute in the future');
    }

    // 7. No time conflict
    const prefs = await this.getPreferences(accountId);
    const minGap = prefs.min_gap_hours ?? prefs.minGapHours ?? 4;
    const conflict = await this.detectConflicts(accountId, proposedAt, minGap);
    if (conflict) {
      errors.push(`Another post is scheduled too close to this time (minimum gap: ${minGap}h)`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Pre-publish validation — run immediately before every Instagram publish attempt.
   */
  async validatePrePublish(postId: string): Promise<ScheduleValidationResult> {
    const errors: string[] = [];

    const posts = await sql`
      SELECT p.*, ci.caption, ci.status AS content_status
      FROM posts p
      LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
      WHERE p.id = ${postId}
    `;
    if (!posts.length) { return { valid: false, errors: ['Post not found'] }; }
    const post = posts[0];

    // Content checks
    if (post.status === 'published')  errors.push('Content already published');
    if (post.status === 'cancelled')  errors.push('Schedule is cancelled');
    if (post.scheduleStatus === 'CANCELLED') errors.push('Schedule is cancelled');
    if (post.scheduleStatus === 'MISSED')    errors.push('Schedule was missed');
    if (post.contentStatus === 'blocked')    errors.push('Content is blocked');
    if (!post.caption?.trim())               errors.push('Caption is empty');

    // Media checks — must have ACTIVE + READY asset
    const activeAsset = await sql`
      SELECT ca.id, ca.storage_url, ca.asset_status, mr.status AS req_status
      FROM content_assets ca
      JOIN media_requirements mr ON ca.media_requirement_id = mr.id
      WHERE mr.content_idea_id = ${post.contentIdeaId}
        AND ca.asset_status = 'ACTIVE'
      LIMIT 1
    `;
    if (!activeAsset.length) {
      errors.push('No ACTIVE media asset found');
    } else {
      const asset = activeAsset[0];
      if (asset.reqStatus !== 'READY') {
        errors.push(`Media requirement is not READY (status: ${asset.reqStatus})`);
      }
      if (!asset.storageUrl) {
        errors.push('Media storage URL is missing');
      }
    }

    // Instagram account checks
    const account = await sql`
      SELECT connection_status, access_token_encrypted, token_expires_at
      FROM social_accounts WHERE id = ${post.socialAccountId}
    `;
    if (!account.length) {
      errors.push('Social account not found');
    } else {
      const acc = account[0];
      if (acc.connectionStatus !== 'connected') errors.push('Instagram account is disconnected');
      if (!acc.accessTokenEncrypted) errors.push('Instagram access token is missing');
      if (acc.tokenExpiresAt && new Date(acc.tokenExpiresAt) < new Date()) {
        errors.push('Instagram access token has expired');
      }
    }

    // Schedule time check
    if (post.scheduledAt && new Date(post.scheduledAt) > new Date(Date.now() + 5 * 60 * 1000)) {
      errors.push('Scheduled time has not yet arrived');
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Schedule CRUD ────────────────────────────────────────────────────────────

  /**
   * Creates a new schedule (post record) from a content idea.
   * Also creates the first schedule_version and enqueues the BullMQ delayed job.
   */
  async createSchedule(params: {
    contentIdeaId: string;
    accountId: string;
    scheduledAt: Date;
    timezone: string;
    source: 'AGENT' | 'USER' | 'SYSTEM';
    actor: string;
    reason?: string;
    recommendationId?: string;
  }): Promise<CreateScheduleResult> {
    const {
      contentIdeaId, accountId, scheduledAt, timezone,
      source, actor, reason, recommendationId,
    } = params;

    const postId = randomUUID();
    const idempotencyKey = `schedule:${accountId}:${contentIdeaId}`;

    // Fetch content idea for caption + format
    const ideas = await sql`
      SELECT caption, format, strategy_version_id FROM content_ideas
      WHERE id = ${contentIdeaId}
    `;
    const idea = ideas[0];
    if (!idea) throw new Error('Content idea not found');

    await sql.begin(async (trx) => {
      // Update content idea status
      await trx`
        UPDATE content_ideas
        SET status = 'scheduled', updated_at = NOW()
        WHERE id = ${contentIdeaId}
      `;

      // Create the post (schedule record)
      await trx`
        INSERT INTO posts (
          id, social_account_id, content_idea_id, caption, media_type,
          scheduled_at, schedule_timezone, status, schedule_status,
          strategy_version_id, idempotency_key, recommendation_id
        ) VALUES (
          ${postId}, ${accountId}, ${contentIdeaId},
          ${idea.caption}, ${idea.format},
          ${scheduledAt.toISOString()}, ${timezone},
          'scheduled', 'SCHEDULED',
          ${idea.strategy_version_id ?? null},
          ${idempotencyKey},
          ${recommendationId ?? null}
        )
      `;

      // Create v1 schedule version
      await trx`
        INSERT INTO schedule_versions (
          post_id, version, scheduled_at, timezone, source, reason, actor, schedule_status
        ) VALUES (
          ${postId}, 1, ${scheduledAt.toISOString()}, ${timezone},
          ${source}, ${reason ?? 'Initial schedule'}, ${actor}, 'SCHEDULED'
        )
      `;

      // Update recommendation status if linked
      if (recommendationId) {
        await trx`
          UPDATE schedule_recommendations
          SET status = 'ACCEPTED', updated_at = NOW()
          WHERE id = ${recommendationId}
        `;
      }
    });

    // Create durable publish job + BullMQ delayed job
    const { publishJobId, bullmqJobId } = await this.createPublishJob(postId, accountId, contentIdeaId, scheduledAt);

    return { postId, scheduledAt, timezone, publishJobId, bullmqJobId };
  }

  /**
   * Reschedules an existing post to a new time.
   * Cancels the old BullMQ job, creates a new schedule_version, enqueues new job.
   */
  async reschedule(params: {
    postId: string;
    accountId: string;
    newScheduledAt: Date;
    newTimezone: string;
    reason: string;
    actor: string;
    source: 'AGENT' | 'USER' | 'SYSTEM';
  }): Promise<void> {
    const { postId, accountId, newScheduledAt, newTimezone, reason, actor, source } = params;

    // Fetch current post
    const posts = await sql`
      SELECT content_idea_id, schedule_status FROM posts
      WHERE id = ${postId} AND social_account_id = ${accountId}
    `;
    if (!posts.length) throw new Error('Post not found');
    const post = posts[0];
    if (post.schedule_status === 'CANCELLED') throw new Error('Cannot reschedule a cancelled post');

    // Get next version number
    const versionRows = await sql`
      SELECT COALESCE(MAX(version), 0) AS max_v FROM schedule_versions WHERE post_id = ${postId}
    `;
    const nextVersion = Number(versionRows[0]?.max_v ?? 0) + 1;

    // Cancel existing BullMQ job
    await this.cancelPublishJob(postId);

    await sql.begin(async (trx) => {
      // Update post
      await trx`
        UPDATE posts
        SET scheduled_at = ${newScheduledAt.toISOString()},
            schedule_timezone = ${newTimezone},
            schedule_status = 'SCHEDULED',
            status = 'scheduled',
            updated_at = NOW()
        WHERE id = ${postId}
      `;

      // Add new version
      await trx`
        INSERT INTO schedule_versions (
          post_id, version, scheduled_at, timezone, source, reason, actor, schedule_status
        ) VALUES (
          ${postId}, ${nextVersion}, ${newScheduledAt.toISOString()}, ${newTimezone},
          ${source}, ${reason}, ${actor}, 'SCHEDULED'
        )
      `;
    });

    // Enqueue new delayed job
    await this.createPublishJob(postId, accountId, post.contentIdeaId, newScheduledAt);
  }

  /**
   * Cancels a schedule. Preserves all history.
   */
  async cancelSchedule(params: {
    postId: string;
    accountId: string;
    reason: string;
    actor: string;
  }): Promise<void> {
    const { postId, accountId, reason, actor } = params;

    const posts = await sql`
      SELECT content_idea_id, schedule_status FROM posts
      WHERE id = ${postId} AND social_account_id = ${accountId}
    `;
    if (!posts.length) throw new Error('Post not found');
    if (posts[0].scheduleStatus === 'CANCELLED') return; // Already cancelled

    const versionRows = await sql`
      SELECT COALESCE(MAX(version), 0) AS max_v FROM schedule_versions WHERE post_id = ${postId}
    `;
    const nextVersion = Number(versionRows[0]?.maxV ?? 0) + 1;

    // Cancel BullMQ job
    await this.cancelPublishJob(postId);

    await sql.begin(async (trx) => {
      await trx`
        UPDATE posts
        SET schedule_status = 'CANCELLED', status = 'cancelled', updated_at = NOW()
        WHERE id = ${postId}
      `;
      await trx`
        UPDATE content_ideas
        SET status = 'draft', updated_at = NOW()
        WHERE id = ${posts[0].contentIdeaId}
      `;
      await trx`
        INSERT INTO schedule_versions (
          post_id, version, scheduled_at, timezone, source, reason, actor, schedule_status
        )
        SELECT
          post_id, ${nextVersion}, scheduled_at, schedule_timezone,
          'USER', ${reason}, ${actor}, 'CANCELLED'
        FROM schedule_versions
        WHERE post_id = ${postId}
        ORDER BY version DESC LIMIT 1
      `;
    });
  }

  // ── Publish Job Management ───────────────────────────────────────────────────

  /**
   * Creates a publish_jobs record and enqueues a BullMQ delayed job.
   * Safe to call multiple times — uses idempotency key.
   */
  async createPublishJob(
    postId: string,
    accountId: string,
    contentIdeaId: string,
    scheduledAt: Date,
  ): Promise<{ publishJobId: string; bullmqJobId: string }> {
    const idempotencyKey = `publish:${accountId}:${postId}`;
    const publishJobId = randomUUID();
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    // Upsert publish_job (idempotent)
    const existing = await sql`
      SELECT id, bullmq_job_id FROM publish_jobs WHERE idempotency_key = ${idempotencyKey}
    `;

    if (existing.length > 0) {
      // Job already exists — return existing IDs
      return {
        publishJobId: existing[0].id,
        bullmqJobId: existing[0].bullmqJobId ?? 'existing',
      };
    }

    const bullmqJobId = `publish-${postId}`;

    await sql`
      INSERT INTO publish_jobs (
        id, post_id, content_idea_id, account_id,
        status, idempotency_key, bullmq_job_id
      ) VALUES (
        ${publishJobId}, ${postId}, ${contentIdeaId}, ${accountId},
        'PENDING', ${idempotencyKey}, ${bullmqJobId}
      )
    `;

    // Enqueue BullMQ delayed job
    await queues.publishing.add(
      'publish-scheduled-post',
      {
        postId,
        publishJobId,
        accountId,
        contentIdeaId,
        idempotencyKey,
      },
      {
        jobId: bullmqJobId,
        delay,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );

    return { publishJobId, bullmqJobId };
  }

  /**
   * Cancels the BullMQ job for a post (if it exists and hasn't fired yet).
   */
  async cancelPublishJob(postId: string): Promise<void> {
    try {
      const bullmqJobId = `publish-${postId}`;
      const job = await queues.publishing.getJob(bullmqJobId);
      if (job) {
        const state = await job.getState();
        // Only cancel if it hasn't started processing
        if (state === 'delayed' || state === 'waiting') {
          await job.remove();
        }
      }
      // Update publish_jobs record
      await sql`
        UPDATE publish_jobs
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE post_id = ${postId} AND status IN ('PENDING', 'RETRYING')
      `;
    } catch (err) {
      // Non-fatal — job may have already been processed or not exist
      console.warn('[SchedulingService] cancelPublishJob warning:', err);
    }
  }

  // ── Query Helpers ────────────────────────────────────────────────────────────

  async getSchedule(postId: string, accountId: string) {
    const posts = await sql`
      SELECT p.*,
        row_to_json(pj.*) AS publish_job,
        (SELECT json_agg(sv.* ORDER BY sv.version ASC)
         FROM schedule_versions sv WHERE sv.post_id = p.id) AS versions,
        (SELECT json_agg(ae.* ORDER BY ae.created_at ASC)
         FROM agent_events ae
         JOIN agent_steps ast ON ae.agent_step_id = ast.id
         WHERE ae.metadata::jsonb ->> 'postId' = p.id::text
         LIMIT 20) AS activity
      FROM posts p
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      WHERE p.id = ${postId} AND p.social_account_id = ${accountId}
    `;
    return posts[0] ?? null;
  }

  async getUpcomingSchedules(accountId: string, limit = 10) {
    return sql`
      SELECT p.*,
        ci.hook, ci.pillar, ci.format, ci.concept,
        ca.storage_url AS media_url,
        ca.asset_type AS media_type_detail,
        mr.status AS media_status,
        pj.status AS publish_job_status,
        pj.error_code AS publish_error_code
      FROM posts p
      LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
      LEFT JOIN media_requirements mr ON mr.content_idea_id = ci.id
      LEFT JOIN content_assets ca ON ca.media_requirement_id = mr.id AND ca.asset_status = 'ACTIVE'
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      WHERE p.social_account_id = ${accountId}
        AND p.schedule_status IN ('SCHEDULED', 'SUGGESTED')
        AND p.scheduled_at > NOW()
      ORDER BY p.scheduled_at ASC
      LIMIT ${limit}
    `;
  }

  async getCalendarData(accountId: string, year: number, month: number) {
    const startDate = DateTime.fromObject({ year, month, day: 1 }).startOf('month').toISO();
    const endDate   = DateTime.fromObject({ year, month, day: 1 }).endOf('month').toISO();

    return sql`
      SELECT p.*,
        ci.hook, ci.pillar, ci.format,
        ca.storage_url AS media_url,
        mr.status AS media_status,
        pj.status AS publish_job_status
      FROM posts p
      LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
      LEFT JOIN media_requirements mr ON mr.content_idea_id = ci.id
      LEFT JOIN content_assets ca ON ca.media_requirement_id = mr.id AND ca.asset_status = 'ACTIVE'
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      WHERE p.social_account_id = ${accountId}
        AND p.scheduled_at BETWEEN ${startDate} AND ${endDate}
      ORDER BY p.scheduled_at ASC
    `;
  }

  async getScheduleHistory(postId: string, accountId: string) {
    // Verify ownership
    const posts = await sql`SELECT id FROM posts WHERE id = ${postId} AND social_account_id = ${accountId}`;
    if (!posts.length) throw new Error('Post not found');

    return sql`
      SELECT * FROM schedule_versions
      WHERE post_id = ${postId}
      ORDER BY version ASC
    `;
  }

  /**
   * Checks if media is ready for a scheduled post.
   * Used by the orchestrator for upcoming-schedule health checks.
   */
  async isMediaReady(contentIdeaId: string): Promise<boolean> {
    const assets = await sql`
      SELECT ca.id FROM content_assets ca
      JOIN media_requirements mr ON ca.media_requirement_id = mr.id
      WHERE mr.content_idea_id = ${contentIdeaId}
        AND ca.asset_status = 'ACTIVE'
        AND mr.status = 'READY'
      LIMIT 1
    `;
    return assets.length > 0;
  }
}
