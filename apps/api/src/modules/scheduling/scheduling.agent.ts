/**
 * SchedulingAgent
 *
 * LLM-assisted scheduling recommendation layer.
 * Uses the LLM ONLY to:
 *   1. Synthesize an explainable reasoning_summary (safe summary, no chain-of-thought)
 *   2. Interpret content intent/category for matching with engagement patterns
 *
 * All date/time arithmetic, conflict detection and window generation is delegated
 * to SchedulingService (deterministic, no LLM).
 *
 * Per spec §8: Do NOT expose internal reasoning traces. Output only:
 *   Observation → Evidence → Recommendation
 *
 * Per spec §47/82: Never claim "maximum engagement" or "guaranteed results".
 */
import { z } from 'zod';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { AgentRunTracker } from '../agent/agent-tracker.js';
import { SchedulingService, CandidateWindow } from './scheduling.service.js';
import { DateTime } from 'luxon';
import { env } from '../../config/env.js';

const schedulingService = new SchedulingService();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleRecommendation {
  id: string;
  contentIdeaId: string;
  accountId: string;
  recommendedAt: Date;
  timezone: string;
  reasoningSummary: string;
  supportingSignals: RecommendationSignal[];
  candidateWindows: CandidateWindow[];
  status: 'SUGGESTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
  createdAt: Date;
}

export interface RecommendationSignal {
  type: 'engagement_window' | 'content_type' | 'strategy_cadence' | 'low_data' | 'spacing';
  label: string;
  evidence: string;
}

// ─── SchedulingAgent ──────────────────────────────────────────────────────────

export class SchedulingAgent {
  private llm = getLLMProvider();

  /**
   * Generates a schedule recommendation for a single content idea.
   *
   * Steps:
   * 1. Validate that content is ready enough to recommend a schedule
   * 2. Fetch available analytics signals
   * 3. Generate candidate windows via SchedulingService (deterministic)
   * 4. Use LLM to synthesize an explainable summary
   * 5. Persist recommendation
   * 6. Log agent event
   */
  async generateRecommendation(
    contentIdeaId: string,
    accountId: string,
    agentRunId?: string,
    stepId?: string,
  ): Promise<ScheduleRecommendation> {
    const tracker = agentRunId ? new AgentRunTracker(agentRunId) : null;

    const log = (msg: string) => {
      console.log(`[SchedulingAgent] ${msg}`);
      return tracker?.addLog(msg) ?? Promise.resolve();
    };

    await log(`Generating schedule recommendation for content ${contentIdeaId}`);

    // ── 1. Fetch content idea ────────────────────────────────────────────────
    const ideas = await sql`
      SELECT ci.*, sv.cadence, sv.content_mix
      FROM content_ideas ci
      LEFT JOIN strategy_versions sv ON ci.strategy_version_id = sv.id
      WHERE ci.id = ${contentIdeaId} AND ci.social_account_id = ${accountId}
    `;
    if (!ideas.length) throw new Error('Content idea not found');
    const idea = ideas[0];

    // Expire any old SUGGESTED recommendations for this content
    await sql`
      UPDATE schedule_recommendations
      SET status = 'SUPERSEDED', updated_at = NOW()
      WHERE content_idea_id = ${contentIdeaId}
        AND status = 'SUGGESTED'
    `;

    // ── 2. Fetch analytics signals ───────────────────────────────────────────
    const prefs = await schedulingService.getPreferences(accountId);
    const tz = (prefs?.timezone ?? 'UTC') as string;

    // Time-window performance: hours with above-median engagement
    const timeWindowPerf = await sql`
      SELECT
        EXTRACT(HOUR FROM p.published_at AT TIME ZONE ${tz}) AS local_hour,
        AVG(pm.engagement_rate)::numeric(6,4) AS avg_engagement_rate,
        COUNT(p.id)::int AS count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      WHERE p.social_account_id = ${accountId}
        AND p.published_at IS NOT NULL
      GROUP BY local_hour
      ORDER BY avg_engagement_rate DESC
      LIMIT 10
    `;

    // Content-type performance (by format/pillar)
    const contentTypePerf = await sql`
      SELECT
        ci.format,
        ci.pillar,
        AVG(pm.engagement_rate)::numeric(6,4) AS avg_engagement_rate,
        COUNT(p.id)::int AS count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      JOIN content_ideas ci ON p.content_idea_id = ci.id
      WHERE p.social_account_id = ${accountId}
      GROUP BY ci.format, ci.pillar
      HAVING COUNT(p.id) >= 2
    `;

    const hasHistoricalData = timeWindowPerf.length >= 3;

    await log(
      hasHistoricalData
        ? `Found ${timeWindowPerf.length} time-window performance entries`
        : 'Insufficient historical data — will use configured preferences'
    );

    // ── 3. Generate candidate windows (deterministic) ────────────────────────
    const candidates = await schedulingService.getCandidateWindows(accountId, contentIdeaId, 5);

    if (candidates.length === 0) {
      throw new Error(
        'No valid publishing window found. The current posting-frequency rules and conflicts leave no available slot in the next 7 days.'
      );
    }

    const topCandidate = candidates[0]!;

    // ── 4. Build supporting signals ──────────────────────────────────────────
    const supportingSignals: RecommendationSignal[] = [];

    if (!hasHistoricalData) {
      supportingSignals.push({
        type: 'low_data',
        label: 'Limited account history',
        evidence: 'Not enough account-specific historical data yet. This recommendation is based on your configured posting preferences and available account signals.',
      });
    } else {
      // Identify best-performing hour windows
      const top3Hours = timeWindowPerf.slice(0, 3).map((r: any) => `${Number(r.localHour)}:00`);
      supportingSignals.push({
        type: 'engagement_window',
        label: 'Historical engagement pattern',
        evidence: `Posts published around ${top3Hours.join(', ')} (${tz}) have shown above-median engagement in account history.`,
      });
    }

    // Content type performance signal
    const matchingFormat = contentTypePerf.find(
      (r: any) => r.format === idea?.format || r.pillar === idea?.pillar
    );
    if (matchingFormat && Number(matchingFormat.count) >= 2) {
      supportingSignals.push({
        type: 'content_type',
        label: `${idea?.pillar ?? idea?.format} performance`,
        evidence: `${Number(matchingFormat.count)} comparable posts (${idea?.pillar ?? idea?.format}) averaged ${Number(matchingFormat.avgEngagementRate * 100).toFixed(1)}% engagement.`,
      });
    }

    // Strategy cadence signal
    if (idea?.cadence) {
      const cadence = typeof idea.cadence === 'string' ? JSON.parse(idea.cadence) : idea.cadence;
      if (cadence.postsPerWeek) {
        supportingSignals.push({
          type: 'strategy_cadence',
          label: 'Strategy cadence',
          evidence: `Current strategy targets ${cadence.postsPerWeek} posts/week. This slot maintains the required spacing.`,
        });
      }
    }

    // Candidates signal
    supportingSignals.push({
      type: 'spacing',
      label: 'Conflict-free window',
      evidence: `${candidates.length} candidate windows evaluated; ${candidates.length > 1 ? `${candidates.length - 1} alternative(s) available` : 'this is the only available slot'}.`,
    });

    // Add candidate signals from SchedulingService
    topCandidate.signals.forEach(s => {
      supportingSignals.push({ type: 'engagement_window', label: s, evidence: s });
    });

    // ── 5. LLM: synthesize reasoning_summary ────────────────────────────────
    let reasoningSummary = '';

    const localTime = DateTime.fromJSDate(topCandidate.scheduledAt)
      .setZone(topCandidate.timezone)
      .toFormat("EEEE, d MMMM yyyy 'at' h:mm a ZZZZ");

    try {
      const systemPrompt = `You are a social media scheduling assistant. Your job is to write a brief, honest explanation of WHY a specific publishing time is recommended.

Rules:
- Write in the format: Observation → Evidence → Recommendation  
- Do NOT claim "maximum engagement" or "guaranteed results"
- Use hedged language: "historically", "suggests", "based on available data"
- If data is limited, say so honestly
- Keep the summary under 120 words
- Return ONLY valid JSON: {"observation": string, "evidence": string, "recommendation": string}
- Do NOT expose internal reasoning or model thinking`;

      const userPrompt = `Content: "${idea?.hook || idea?.concept}"
Pillar: ${idea?.pillar}
Format: ${idea?.format}
Recommended time: ${localTime}
Timezone: ${topCandidate.timezone}

Available signals:
${supportingSignals.map(s => `- ${s.evidence}`).join('\n')}

Write the scheduling explanation.`;

      const schedulingExplanationSchema = z.object({
        observation: z.string(),
        evidence: z.string(),
        recommendation: z.string(),
      });

      const response = await this.llm.generateStructured({
        systemPrompt,
        userPrompt,
        outputSchema: schedulingExplanationSchema,
        schemaName: 'schedulingExplanation',
        model: env.OPENROUTER_DEFAULT_MODEL,
      });


      const r = response.structured as any;
      if (r?.observation && r?.evidence && r?.recommendation) {
        reasoningSummary = [
          `Observation: ${r.observation}`,
          `Evidence: ${r.evidence}`,
          `Recommendation: ${r.recommendation}`,
        ].join('\n\n');
      }
    } catch (err) {
      console.warn('[SchedulingAgent] LLM explanation failed, using fallback', err);
    }

    // Fallback if LLM failed
    if (!reasoningSummary) {
      reasoningSummary = hasHistoricalData
        ? `Recommended publishing window based on available engagement signals and ${topCandidate.timezone} preferences.`
        : `Recommendation based on your configured posting preferences and available platform signals. Not enough account-specific historical data yet.`;
    }

    // ── 6. Persist recommendation ────────────────────────────────────────────
    const expiresAt = new Date(topCandidate.scheduledAt.getTime() + 24 * 3600 * 1000);

    const [rec] = await sql`
      INSERT INTO schedule_recommendations (
        content_idea_id, account_id, recommended_at, timezone,
        reasoning_summary, supporting_signals, candidate_windows,
        status, expires_at
      ) VALUES (
        ${contentIdeaId}, ${accountId},
        ${topCandidate.scheduledAt.toISOString()}, ${topCandidate.timezone},
        ${reasoningSummary},
        ${sql.json(supportingSignals as any)},
        ${sql.json(candidates.map(c => ({ ...c, scheduledAt: c.scheduledAt.toISOString() })) as any)},
        'SUGGESTED',
        ${expiresAt.toISOString()}
      )
      RETURNING *
    `;

    if (!rec) throw new Error('Failed to persist schedule recommendation');

    await log(`Schedule recommendation created: ${topCandidate.localLabel} (${topCandidate.timezone})`);

    // ── 7. Log agent event ───────────────────────────────────────────────────
    if (tracker && stepId) {
      await tracker.logEvent(
        stepId,
        'SCHEDULE_RECOMMENDATION_CREATED',
        'info',
        `Recommended schedule: ${topCandidate.localLabel} (${topCandidate.timezone})`,
        { recommendationId: rec.id, contentIdeaId, candidateCount: candidates.length },
      );
    }

    return {
      id: rec.id as string,
      contentIdeaId: rec.contentIdeaId as string,
      accountId: rec.accountId as string,
      recommendedAt: new Date(rec.recommendedAt as string),
      timezone: rec.timezone as string,
      reasoningSummary: rec.reasoningSummary as string,
      supportingSignals: rec.supportingSignals as RecommendationSignal[],
      candidateWindows: candidates,
      status: rec.status as ScheduleRecommendation['status'],
      createdAt: new Date(rec.createdAt as string),
    };
  }

  /**
   * Generates recommendations for multiple content ideas in sequence.
   * Used by the orchestrator in autonomous mode.
   * Non-blocking: one failure does not stop others.
   */
  async generateBulkRecommendations(
    accountId: string,
    contentIdeaIds: string[],
    agentRunId?: string,
    stepId?: string,
  ): Promise<{ id: string; success: boolean; error?: string }[]> {
    const results = [];
    for (const ideaId of contentIdeaIds) {
      try {
        const rec = await this.generateRecommendation(ideaId, accountId, agentRunId, stepId);
        results.push({ id: rec.id, success: true });
      } catch (err: any) {
        console.error(`[SchedulingAgent] Failed to recommend for ${ideaId}:`, err.message);
        results.push({ id: ideaId, success: false, error: err.message });
      }
    }
    return results;
  }
}
