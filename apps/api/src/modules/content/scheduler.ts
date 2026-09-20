import { sql } from '../../db/client.js';
import { randomUUID } from 'crypto';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { DateTime } from 'luxon';

const schedulingService = new SchedulingService();

export class ContentScheduler {
  async schedulePost(contentIdeaId: string, accountId: string, requestedScheduledAt?: Date, recommendationId?: string) {
    // 1. Determine best time window
    let scheduledAt = requestedScheduledAt;
    const prefs = await schedulingService.getPreferences(accountId);
    const tz = (prefs?.timezone ?? 'UTC') as string;

    if (!scheduledAt) {
      // (Simplified logic: schedule 1 day from now at 10 AM in user's timezone)
      scheduledAt = DateTime.now().setZone(tz).plus({ days: 1 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
    }

    // 2. Delegate to the unified scheduling service
    const result = await schedulingService.createSchedule({
      contentIdeaId,
      accountId,
      scheduledAt,
      timezone: tz,
      source: 'SYSTEM',
      actor: 'system',
      recommendationId,
    });

    return { success: true, postId: result.postId, scheduledAt: result.scheduledAt };
  }
}
