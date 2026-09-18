/**
 * schedule.routes.ts
 *
 * REST API for the scheduling system:
 *   GET    /api/schedules                      — paginated schedule list
 *   GET    /api/schedules/upcoming             — next N upcoming posts
 *   GET    /api/schedules/calendar             — calendar view data
 *   GET    /api/schedules/stats                — counts by status
 *   GET    /api/schedules/:id                  — single schedule detail
 *   PATCH  /api/schedules/:id                  — edit date/time
 *   POST   /api/schedules/:id/reschedule       — reschedule with reason
 *   POST   /api/schedules/:id/cancel           — cancel
 *   GET    /api/schedules/:id/history          — version history
 *   POST   /api/schedules/:id/retry-publish    — manual publish retry
 *   POST   /api/content/ideas/:id/schedule/recommend  — generate AI recommendation
 *   POST   /api/content/ideas/:id/schedule            — create schedule (accept or custom)
 *   GET    /api/content/ideas/:id/schedule            — get schedule for a content idea
 *   GET    /api/scheduling/preferences                 — get preferences
 *   PUT    /api/scheduling/preferences                 — update preferences
 */
import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { SchedulingService } from './scheduling.service.js';
import { SchedulingAgent } from './scheduling.agent.js';

const schedulingService = new SchedulingService();
const schedulingAgent   = new SchedulingAgent();

export default async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const rows = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return rows[0]?.id as string | undefined;
  }

  // ── Scheduling Preferences ──────────────────────────────────────────────────

  app.get('/scheduling/preferences', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No social account found' });
    return { success: true, data: await schedulingService.getPreferences(accountId) };
  });

  app.put('/scheduling/preferences', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No social account found' });
    const prefs = request.body as any;
    const result = await schedulingService.upsertPreferences(accountId, prefs);
    return { success: true, data: result };
  });

  // ── Recommendation ─────────────────────────────────────────────────────────

  /** POST /api/content/ideas/:id/schedule/recommend */
  app.post('/content/ideas/:id/schedule/recommend', async (request: any, reply) => {
    const { id: contentIdeaId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No social account found' });

    // Verify ownership
    const ideas = await sql`
      SELECT id, status FROM content_ideas
      WHERE id = ${contentIdeaId} AND social_account_id = ${accountId}
    `;
    if (!ideas.length) return reply.status(404).send({ error: 'Content not found' });

    // Check if account has a configured timezone
    const account = await sql`SELECT timezone FROM social_accounts WHERE id = ${accountId}`;
    if (!account.length || account[0]?.timezone === 'UTC') {
      // Check if preferences exist with a non-UTC timezone
      const prefs = await sql`SELECT timezone FROM scheduling_preferences WHERE account_id = ${accountId}`;
      if (!prefs.length || prefs[0]?.timezone === 'UTC') {
        // Not blocking, but include a warning
        reply.header('X-Timezone-Warning', 'Timezone not configured. Using UTC. Configure at /dashboard/schedule/preferences');
      }
    }

    try {
      const recommendation = await schedulingAgent.generateRecommendation(contentIdeaId, accountId);
      return { success: true, data: recommendation };
    } catch (err: any) {
      app.log.error(err, 'Failed to generate schedule recommendation');
      return reply.status(422).send({ error: err.message });
    }
  });

  /** POST /api/content/ideas/:id/schedule — Create schedule */
  app.post('/content/ideas/:id/schedule', async (request: any, reply) => {
    const { id: contentIdeaId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No social account found' });

    const {
      scheduledAt,
      timezone,
      recommendationId,
      reason = 'User accepted schedule',
    } = request.body as {
      scheduledAt: string;
      timezone: string;
      recommendationId?: string;
      reason?: string;
    };

    if (!scheduledAt || !timezone) {
      return reply.status(400).send({ error: 'scheduledAt and timezone are required' });
    }

    const proposedDate = new Date(scheduledAt);
    if (isNaN(proposedDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid scheduledAt date' });
    }

    // Full validation
    const validation = await schedulingService.validateForScheduling(
      contentIdeaId, accountId, proposedDate
    );
    if (!validation.valid) {
      return reply.status(422).send({ error: 'Scheduling validation failed', details: validation.errors });
    }

    const result = await schedulingService.createSchedule({
      contentIdeaId,
      accountId,
      scheduledAt: proposedDate,
      timezone,
      source: 'USER',
      actor: request.user.email ?? 'user',
      reason,
      recommendationId,
    });

    return { success: true, data: result };
  });

  /** GET /api/content/ideas/:id/schedule — Get schedule for a content idea */
  app.get('/content/ideas/:id/schedule', async (request: any, reply) => {
    const { id: contentIdeaId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No social account found' });

    // Get current post/schedule
    const posts = await sql`
      SELECT p.*,
        row_to_json(pj.*) AS publish_job
      FROM posts p
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      WHERE p.content_idea_id = ${contentIdeaId}
        AND p.social_account_id = ${accountId}
        AND p.schedule_status NOT IN ('CANCELLED')
      ORDER BY p.created_at DESC
      LIMIT 1
    `;

    // Get latest recommendation
    const recommendations = await sql`
      SELECT * FROM schedule_recommendations
      WHERE content_idea_id = ${contentIdeaId}
        AND account_id = ${accountId}
      ORDER BY created_at DESC
      LIMIT 3
    `;

    // Get media status
    const mediaReq = await sql`
      SELECT status FROM media_requirements WHERE content_idea_id = ${contentIdeaId} LIMIT 1
    `;

    return {
      success: true,
      data: {
        schedule: posts[0] ?? null,
        recommendations,
        mediaStatus: mediaReq[0]?.status ?? null,
      },
    };
  });

  // ── Schedule List & Calendar ────────────────────────────────────────────────

  /** GET /api/schedules */
  app.get('/schedules', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return { success: true, data: [], total: 0 };

    const {
      status,
      page = '1',
      limit = '20',
      from,
      to,
    } = request.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const schedules = await sql`
      SELECT p.*,
        ci.hook, ci.pillar, ci.format, ci.concept,
        ca.storage_url AS media_url,
        mr.status AS media_status,
        pj.status AS publish_job_status,
        pj.error_code,
        pj.attempts AS publish_attempts_count,
        pj.last_error_message
      FROM posts p
      LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
      LEFT JOIN media_requirements mr ON mr.content_idea_id = ci.id
      LEFT JOIN content_assets ca ON ca.media_requirement_id = mr.id AND ca.asset_status = 'ACTIVE'
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      WHERE p.social_account_id = ${accountId}
        ${status ? sql`AND p.schedule_status = ${status}` : sql``}
        ${from ? sql`AND p.scheduled_at >= ${from}` : sql``}
        ${to   ? sql`AND p.scheduled_at <= ${to}`   : sql``}
      ORDER BY p.scheduled_at DESC NULLS LAST
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*)::int AS c FROM posts p
      WHERE p.social_account_id = ${accountId}
        ${status ? sql`AND p.schedule_status = ${status}` : sql``}
    `;

    return {
      success: true,
      data: schedules,
      total: Number(countResult[0]?.c ?? 0),
      page: pageNum,
      limit: limitNum,
    };
  });

  /** GET /api/schedules/upcoming */
  app.get('/schedules/upcoming', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return { success: true, data: [] };
    const { limit = '10' } = request.query as any;
    const data = await schedulingService.getUpcomingSchedules(accountId, parseInt(limit));
    return { success: true, data };
  });

  /** GET /api/schedules/calendar?year=&month= */
  app.get('/schedules/calendar', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return { success: true, data: [] };

    const now = new Date();
    const {
      year  = String(now.getFullYear()),
      month = String(now.getMonth() + 1),
    } = request.query as any;

    const data = await schedulingService.getCalendarData(accountId, parseInt(year), parseInt(month));
    return { success: true, data };
  });

  /** GET /api/schedules/stats */
  app.get('/schedules/stats', async (request: any, reply) => {
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return { success: true, data: {} };

    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE p.schedule_status = 'SCHEDULED')::int                        AS scheduled,
        COUNT(*) FILTER (WHERE p.schedule_status = 'MISSED')::int                           AS missed,
        COUNT(*) FILTER (WHERE p.schedule_status = 'CANCELLED')::int                        AS cancelled,
        COUNT(*) FILTER (WHERE p.status = 'published')::int                                 AS published,
        COUNT(*) FILTER (WHERE pj.status = 'FAILED')::int                                   AS publish_failed,
        COUNT(*) FILTER (WHERE mr.status NOT IN ('READY') AND p.schedule_status = 'SCHEDULED')::int AS needs_media
      FROM posts p
      LEFT JOIN publish_jobs pj ON pj.post_id = p.id AND pj.status != 'CANCELLED'
      LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
      LEFT JOIN media_requirements mr ON mr.content_idea_id = ci.id
      WHERE p.social_account_id = ${accountId}
    `;

    return { success: true, data: stats[0] ?? {} };
  });

  // ── Single Schedule ─────────────────────────────────────────────────────────

  /** GET /api/schedules/:id */
  app.get('/schedules/:id', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    const data = await schedulingService.getSchedule(postId, accountId);
    if (!data) return reply.status(404).send({ error: 'Schedule not found' });
    return { success: true, data };
  });

  /** PATCH /api/schedules/:id — Edit time/date */
  app.patch('/schedules/:id', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    const { scheduledAt, timezone, reason = 'User edited schedule' } = request.body as any;
    if (!scheduledAt || !timezone) {
      return reply.status(400).send({ error: 'scheduledAt and timezone are required' });
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) return reply.status(400).send({ error: 'Invalid date' });

    // Validate new time
    const posts = await sql`SELECT content_idea_id FROM posts WHERE id = ${postId} AND social_account_id = ${accountId}`;
    if (!posts.length) return reply.status(404).send({ error: 'Schedule not found' });

    const validation = await schedulingService.validateForScheduling(
      posts[0]?.contentIdeaId as string, accountId, newDate, postId
    );
    // Allow existing schedule conflict with itself — so filter out the current post
    const filteredErrors = validation.errors.filter(e => !e.includes('already has an active schedule'));
    if (filteredErrors.length > 0) {
      return reply.status(422).send({ error: 'Validation failed', details: filteredErrors });
    }

    await schedulingService.reschedule({
      postId,
      accountId,
      newScheduledAt: newDate,
      newTimezone: timezone,
      reason,
      actor: request.user.email ?? 'user',
      source: 'USER',
    });

    return { success: true, data: { postId, scheduledAt: newDate, timezone } };
  });

  /** POST /api/schedules/:id/reschedule */
  app.post('/schedules/:id/reschedule', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    const { scheduledAt, timezone, reason = 'User rescheduled' } = request.body as any;
    if (!scheduledAt || !timezone) return reply.status(400).send({ error: 'scheduledAt and timezone required' });

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) return reply.status(400).send({ error: 'Invalid date' });

    // Validate new time
    const posts = await sql`SELECT content_idea_id FROM posts WHERE id = ${postId} AND social_account_id = ${accountId}`;
    if (!posts.length) return reply.status(404).send({ error: 'Schedule not found' });

    const validation = await schedulingService.validateForScheduling(
      posts[0]?.contentIdeaId as string, accountId, newDate, postId
    );
    const filteredErrors = validation.errors.filter(e => !e.includes('already has an active schedule'));
    if (filteredErrors.length > 0) {
      return reply.status(422).send({ error: 'Validation failed', details: filteredErrors });
    }

    await schedulingService.reschedule({
      postId,
      accountId,
      newScheduledAt: newDate,
      newTimezone: timezone,
      reason,
      actor: request.user.email ?? 'user',
      source: 'USER',
    });

    return { success: true, data: { postId, scheduledAt: newDate, timezone } };
  });

  /** POST /api/schedules/:id/cancel */
  app.post('/schedules/:id/cancel', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    const { reason = 'Cancelled by user' } = (request.body as any) ?? {};

    await schedulingService.cancelSchedule({
      postId,
      accountId,
      reason,
      actor: request.user.email ?? 'user',
    });

    return { success: true };
  });

  /** GET /api/schedules/:id/history */
  app.get('/schedules/:id/history', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    const history = await schedulingService.getScheduleHistory(postId, accountId);
    return { success: true, data: history };
  });

  /** POST /api/schedules/:id/retry-publish */
  app.post('/schedules/:id/retry-publish', async (request: any, reply) => {
    const { id: postId } = request.params as any;
    const accountId = await getPrimaryAccount(request.user.id);
    if (!accountId) return reply.status(404).send({ error: 'No account' });

    // Verify ownership and status
    const posts = await sql`
      SELECT content_idea_id, schedule_status FROM posts
      WHERE id = ${postId} AND social_account_id = ${accountId}
    `;
    if (!posts.length) return reply.status(404).send({ error: 'Schedule not found' });

    // Validate before re-queuing
    const validation = await schedulingService.validatePrePublish(postId);
    const criticalErrors = validation.errors.filter(e =>
      !e.includes('Scheduled time has not yet arrived')
    );
    if (criticalErrors.length > 0) {
      return reply.status(422).send({ error: 'Cannot retry publish', details: criticalErrors });
    }

    // Reset publish job status and re-enqueue immediately (delay: 0)
    await sql`
      UPDATE publish_jobs
      SET status = 'PENDING', next_retry_at = NULL, updated_at = NOW()
      WHERE post_id = ${postId} AND status IN ('FAILED', 'ACTION_REQUIRED')
    `;

    const { queues } = await import('../../queues/index.js');
    const bullmqJobId = `retry-publish-${postId}-${Date.now()}`;
    await queues.publishing.add(
      'publish-scheduled-post',
      {
        postId,
        accountId,
        contentIdeaId: posts[0]?.contentIdeaId as string,
        idempotencyKey: `publish:${accountId}:${postId}`,
        isRetry: true,
      },
      { jobId: bullmqJobId, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    );

    return { success: true, data: { queued: true, bullmqJobId } };
  });
}
