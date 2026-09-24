/**
 * telegram.formatter.ts - Pure message-formatting functions for Telegram notifications.
 *
 * Rules:
 *  - All output is Telegram MarkdownV2. Special characters are escaped.
 *  - No secrets, no internal IDs in human-visible text - only public-safe summaries.
 *  - Each function accepts only what it needs and returns a plain string.
 */

/** Escapes Telegram MarkdownV2 reserved characters. */
export function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/** Truncates a string to maxLen characters, adding ellipsis if needed. */
function trunc(s: string, maxLen = 80): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + 'e2808f';
}

/** Formats a Date to "21 Sep, 7:30 PM" */
function fmtDate(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// --- Event formatters ---

export function formatAgentStarted(goal: string, dashboardUrl: string): string {
  return [
    '🚀 *Evolvr Agent Started*',
    '',
    `Goal: ${escMd(trunc(goal))}`,
    'Next: Researching account \\& audience\\.',
    '',
    `[Open Dashboard](${escMd(dashboardUrl + '/dashboard')})`,
  ].join('\n');
}

export function formatAgentCompleted(dashboardUrl: string): string {
  return [
    '✅ *Agent Cycle Complete*',
    '',
    'All phases healthy \\- no immediate action required\\.',
    '',
    `[View Activity](${escMd(dashboardUrl + '/dashboard/activity')})`,
  ].join('\n');
}

export function formatAgentPermanentlyFailed(
  workerName: string,
  errorMessage: string,
  dashboardUrl: string,
): string {
  return [
    '🚨 *Agent Permanently Failed*',
    '',
    `Worker: ${escMd(workerName)}`,
    `Error: ${escMd(trunc(errorMessage, 120))}`,
    'Next: Manual review required\\.',
    '',
    `[View Activity](${escMd(dashboardUrl + '/dashboard/activity')})`,
  ].join('\n');
}

export function formatStrategyGenerated(
  versionNumber: number,
  goalType: string,
  dashboardUrl: string,
): string {
  return [
    '🧠 *Strategy Generated*',
    '',
    `Version: \\#${escMd(String(versionNumber))}`,
    `Goal: ${escMd(trunc(goalType))}`,
    'Next: Content generation will begin shortly\\.',
    '',
    `[View Strategy](${escMd(dashboardUrl + '/dashboard/strategy')})`,
  ].join('\n');
}

export function formatContentBatchGenerated(
  count: number,
  dashboardUrl: string,
): string {
  const plural = count === 1 ? '' : 's';
  return [
    '✍️ *Content Batch Generated*',
    '',
    `${escMd(String(count))} new content draft${plural} created\\.`,
    'Next: Media generation queued; scheduling will follow\\.',
    '',
    `[View Content](${escMd(dashboardUrl + '/dashboard/content')})`,
  ].join('\n');
}

export function formatWaitingForMedia(concept: string, mediaType: string, slides: number, dashboardUrl: string, ideaId: string): string {
  return [
    '🎨 *Evolvr Needs Media*',
    '',
    `Concept: ${escMd(trunc(concept))}`,
    `Media: ${escMd(mediaType)}`,
    slides > 1 ? `Slides: ${slides}` : '',
    '',
    'Generate using ChatGPT or Gemini and upload it in Evolvr\\.',
    '',
    `[Open Content](${escMd(dashboardUrl + '/dashboard/content/' + ideaId)})`,
  ].filter(line => line !== '').join('\n');
}

export function formatMediaUploaded(concept: string, dashboardUrl: string): string {
  return [
    '✅ *Media Uploaded*',
    '',
    `Media uploaded for: ${escMd(trunc(concept))}`,
    'The scheduled workflow will now continue\\.',
    '',
    `[Open Content](${escMd(dashboardUrl + '/dashboard/content')})`,
  ].join('\n');
}

export function formatContentScheduled(
  scheduledCount: number,
  dashboardUrl: string,
): string {
  const plural = scheduledCount === 1 ? '' : 's';
  return [
    '📅 *Content Scheduled*',
    '',
    `${escMd(String(scheduledCount))} post${plural} scheduled for publishing\\.`,
    'Next: Agent will publish at the scheduled times\\.',
    '',
    `[View Schedule](${escMd(dashboardUrl + '/dashboard/schedule')})`,
  ].join('\n');
}

export function formatPublishSucceeded(
  caption: string,
  publishedAt: Date,
  dashboardUrl: string,
): string {
  return [
    '✅ *Instagram Post Published*',
    '',
    `Content: "${escMd(trunc(caption, 60))}"`,
    `Published: ${escMd(fmtDate(publishedAt))}`,
    'Next: Performance tracking enabled\\.',
    '',
    `[View Content](${escMd(dashboardUrl + '/dashboard/content')})`,
  ].join('\n');
}

export function formatPublishFailedPermanent(
  caption: string,
  errorCode: string,
  dashboardUrl: string,
): string {
  return [
    '❌ *Instagram Publishing Failed*',
    '',
    `Content: "${escMd(trunc(caption, 60))}"`,
    `Reason: ${escMd(errorCode)}`,
    'Next: Post will not retry automatically \\- manual action required\\.',
    '',
    `[Review Post](${escMd(dashboardUrl + '/dashboard/content')})`,
  ].join('\n');
}

export function formatMediaGenerationFailed(
  caption: string,
  contentIdeaId: string,
  assetType: string,
  dashboardUrl: string,
): string {
  return [
    '⚠️ *Media Required*',
    '',
    `Content: "${escMd(trunc(caption, 60))}"`,
    `AI ${escMd(assetType)} generation failed after retries\\.`,
    'Action: Upload the media in Evolvr to continue the scheduled post\\.',
    '',
    `[Upload Media](${escMd(dashboardUrl + '/dashboard/content/' + contentIdeaId)})`,
  ].join('\n');
}

export function formatInstagramSyncCompleted(
  newPosts: number,
  insightsFetched: number,
  dashboardUrl: string,
): string {
  return [
    '🔄 *Daily Instagram Sync Completed*',
    '',
    `${escMd(String(newPosts))} new post${newPosts === 1 ? '' : 's'} discovered, ${escMd(String(insightsFetched))} insight${insightsFetched === 1 ? '' : 's'} fetched\\.`,
    'Next: Analytics \\& learning analysis will run if sufficient data exists\\.',
    '',
    `[View Analytics](${escMd(dashboardUrl + '/dashboard/analytics')})`,
  ].join('\n');
}

export function formatInstagramAuthFailure(dashboardUrl: string): string {
  return [
    '🔐 *Instagram Authentication Failed*',
    '',
    'Evolvr cannot connect to Instagram \\- the access token has expired or been revoked\\.',
    'Action: Re\\-authenticate your Instagram account to resume the agent\\.',
    '',
    `[Reconnect Account](${escMd(dashboardUrl + '/dashboard/settings')})`,
  ].join('\n');
}

export function formatPerformanceInsight(
  observationCount: number,
  dashboardUrl: string,
): string {
  const plural = observationCount === 1 ? '' : 's';
  return [
    '📊 *Performance Insight*',
    '',
    `${escMd(String(observationCount))} new learning observation${plural} detected from recent post performance\\.`,
    'Evolvr will consider these signals when preparing the next strategy\\/content\\.',
    '',
    `[View Insights](${escMd(dashboardUrl + '/dashboard/analytics')})`,
  ].join('\n');
}
