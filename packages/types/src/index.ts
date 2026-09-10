// ─────────────────────────────────────────────────────────────────────────────
// Evolvr — Shared Types
// This file is the single source of truth for all domain types across the
// monorepo. Both apps/api and apps/web import from @evolvr/types.
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISO8601 = string;
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue }
export type JsonArray = JsonValue[];

// ── Platform / Provider Enums ─────────────────────────────────────────────────

export type SocialPlatform = 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
export type LLMProviderName = 'openrouter' | 'gemini' | 'openai' | 'anthropic';
export type ResearchProviderName = 'serper' | 'tavily';
export type StorageProviderName = 'local' | 's3' | 'r2';
export type MediaProviderName = 'stub' | 'openai-dall-e' | 'stability-ai';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface AuthTokenPayload {
  userId: UUID;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// ── Social Account ────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error';

export interface SocialAccount {
  id: UUID;
  userId: UUID;
  platform: SocialPlatform;
  platformAccountId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  tokenExpiresAt: ISO8601 | null;
  connectionStatus: ConnectionStatus;
  metadata: JsonObject;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ── Account Profile (Brand Memory) ───────────────────────────────────────────

export interface AudienceDefinition {
  description: string;
  demographics?: string;
  painPoints?: string[];
  desires?: string[];
  geographicFocus?: string;
  language?: string;
}

export interface BrandVoice {
  tones: string[];           // e.g. ["practical", "credible", "concise"]
  examplePhrases?: string[];
  avoidPhrases?: string[];
}

export interface VisualGuidelines {
  colorPalette?: string[];
  fontPreferences?: string[];
  style?: string;            // e.g. "clean", "bold", "minimal"
}

export interface PublishingConstraints {
  maxPostsPerDay: number;
  preferredTimeWindows?: TimeWindow[];
  blockedDays?: string[];    // ISO weekdays: "saturday", "sunday"
}

export interface TimeWindow {
  dayOfWeek?: string;        // "monday" | ... | "sunday" | "any"
  startHour: number;         // 0-23 UTC
  endHour: number;           // 0-23 UTC
}

export interface AccountProfile {
  id: UUID;
  socialAccountId: UUID;
  niche: string;
  valueProposition: string;
  audienceDefinition: AudienceDefinition;
  brandVoice: BrandVoice;
  visualGuidelines: VisualGuidelines;
  publishingConstraints: PublishingConstraints;
  businessGoals: string[];
  conversionGoals: string[];
  allowedTopics: string[];
  bannedTopics: string[];
  competitorAccounts: string[];
  preferredCtaPatterns: string[];
  approvalPolicy: ApprovalPolicy;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ── Autonomy / Policy ─────────────────────────────────────────────────────────

export type AutonomyMode = 'manual' | 'supervised' | 'autonomous';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ApprovalPolicy {
  mode: AutonomyMode;
  requireApprovalForMediumRisk: boolean;
  requireApprovalForHighRisk: boolean;
}

export interface PolicyDecision {
  decision: 'allow' | 'review' | 'block';
  risk: RiskLevel;
  reasons: string[];
  requiresApproval: boolean;
  checkResults: PolicyCheckResult[];
}

export interface PolicyCheckResult {
  check: string;
  passed: boolean;
  reason?: string;
}

// ── Admin Goal ────────────────────────────────────────────────────────────────

export type GoalType =
  | 'GROW_ACCOUNT'
  | 'INCREASE_ENGAGEMENT'
  | 'DRIVE_TRAFFIC'
  | 'BUILD_BRAND_AWARENESS'
  | 'GENERATE_LEADS';

export type PrimaryMetric =
  | 'followers'
  | 'reach'
  | 'engagement_rate'
  | 'profile_visits'
  | 'website_clicks'
  | 'shares'
  | 'saves';

export interface GoalConstraints {
  maxPostsPerDay?: number;
  noPolitics?: boolean;
  noControversialContent?: boolean;
  approvedTones?: string[];
  bannedTopics?: string[];
}

export interface AdminGoal {
  id: UUID;
  socialAccountId: UUID;
  goalType: GoalType;
  primaryMetric: PrimaryMetric;
  secondaryMetrics: PrimaryMetric[];
  target: number;
  deadline: ISO8601;
  audience: string;
  businessOutcome: string;
  autonomyLevel: AutonomyMode;
  constraints: GoalConstraints;
  isActive: boolean;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ── Strategy ──────────────────────────────────────────────────────────────────

export type StrategyStatus = 'draft' | 'active' | 'superseded' | 'archived';

export interface ContentMix {
  education: number;       // 0-1 fractions summing to 1
  storytelling: number;
  trend: number;
  product: number;
  community: number;
  opinion: number;
  [pillar: string]: number;
}

export interface Cadence {
  reelsPerWeek: number;
  carouselsPerWeek: number;
  storiesPerWeek: number;
  staticPostsPerWeek: number;
}

export interface StrategyObjective {
  primaryMetric: PrimaryMetric;
  secondaryMetrics: PrimaryMetric[];
  targetGrowthRate?: number;
  rationale?: string;
}

export interface StrategyVersion {
  id: UUID;
  socialAccountId: UUID;
  versionNumber: number;
  objective: StrategyObjective;
  contentMix: ContentMix;
  cadence: Cadence;
  experimentPlan: string[];
  rationale: string;
  evidenceIds: string[];
  confidence: number;       // 0-1
  status: StrategyStatus;
  createdAt: ISO8601;
}

// ── Strategic Insights & Hypotheses ──────────────────────────────────────────

export type InsightCategory =
  | 'content_format'
  | 'hook_type'
  | 'topic'
  | 'posting_time'
  | 'audience_behavior'
  | 'competitor'
  | 'platform_algorithm';

export type InsightStatus = 'active' | 'superseded' | 'invalidated';

export interface StrategicInsight {
  id: UUID;
  socialAccountId: UUID;
  category: InsightCategory;
  statement: string;
  evidence: string[];         // post IDs, experiment IDs, etc.
  confidence: number;         // 0-1
  scope: string;
  status: InsightStatus;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export type HypothesisStatus = 'pending' | 'testing' | 'confirmed' | 'rejected';
export type ExpectedDirection = 'increase' | 'decrease';

export interface Hypothesis {
  id: UUID;
  strategyVersionId: UUID;
  statement: string;
  metric: PrimaryMetric;
  expectedDirection: ExpectedDirection;
  expectedEffect: string;
  status: HypothesisStatus;
  createdAt: ISO8601;
}

// ── Research ──────────────────────────────────────────────────────────────────

export type ResearchCategory =
  | 'trend'
  | 'competitor'
  | 'audience'
  | 'content'
  | 'platform_update';

export interface ResearchQuery {
  category: ResearchCategory;
  questions: string[];
  rationale: string;
  strategicUncertainty?: string;
}

export interface ResearchSource {
  id: UUID;
  researchRunId: UUID;
  sourceUrl: string;
  title: string;
  domain: string;
  fetchedAt: ISO8601;
  excerptOrSummary: string;
  credibilityNotes?: string;
}

export interface SynthesizedFindings {
  summary: string;
  keyInsights: string[];
  actionableRecommendations: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  limitationsAndCaveats: string[];
}

export interface ResearchRun {
  id: UUID;
  socialAccountId: UUID;
  query: ResearchQuery;
  sources: ResearchSource[];
  synthesizedFindings: SynthesizedFindings;
  createdAt: ISO8601;
}

// ── Content ───────────────────────────────────────────────────────────────────

export type ContentPillar = 'education' | 'storytelling' | 'trend' | 'product' | 'community' | 'opinion' | string;
export type ContentFormat = 'reel' | 'carousel' | 'static' | 'story' | 'live';
export type ContentStatus = 'idea' | 'scripted' | 'assets_ready' | 'validated' | 'scheduled' | 'published' | 'failed' | 'rejected' | 'archived';

export interface ContentRationale {
  goal: string;
  pillar: ContentPillar;
  audiencePain: string;
  angle: string;
  format: ContentFormat;
  hook: string;
  cta: string;
  experiment?: string;
}

export interface ContentScore {
  strategyFit: number;     // 0-1
  audienceFit: number;
  evidenceStrength: number;
  novelty: number;
  predictedEngagement: number;
  predictedReach: number;
  brandSafety: number;
  aggregate: number;       // weighted combination
}

export interface ContentIdea {
  id: UUID;
  socialAccountId: UUID;
  strategyVersionId: UUID;
  pillar: ContentPillar;
  format: ContentFormat;
  concept: string;
  hook: string;
  rationale: ContentRationale;
  script?: string;
  caption?: string;
  hashtags?: string[];
  altText?: string;
  score: ContentScore;
  status: ContentStatus;
  policyDecision?: PolicyDecision;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export type AssetType = 'image' | 'video' | 'carousel_slide' | 'story_frame' | 'template';

export interface ContentAsset {
  id: UUID;
  contentIdeaId: UUID;
  assetType: AssetType;
  storageUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  prompt?: string;
  generationMetadata: JsonObject;
  createdAt: ISO8601;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export type PostStatus =
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'waiting_approval'
  | 'cancelled';

export interface Post {
  id: UUID;
  socialAccountId: UUID;
  contentIdeaId: UUID;
  platformPostId: string | null;
  caption: string;
  mediaType: ContentFormat;
  scheduledAt: ISO8601;
  publishedAt: ISO8601 | null;
  status: PostStatus;
  strategyVersionId: UUID;
  experimentId: UUID | null;
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface PostMetrics {
  id: UUID;
  postId: UUID;
  capturedAt: ISO8601;
  impressions: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileVisits: number;
  follows: number;
  clicks: number;
  watchTimeMs: number | null;
  retentionData: JsonObject | null;
  // Derived
  engagementRate: number | null;
  shareRate: number | null;
  saveRate: number | null;
  commentRate: number | null;
  profileVisitRate: number | null;
  followConversionRate: number | null;
  // Raw
  rawMetrics: JsonObject;
}

export interface AccountMetrics {
  id: UUID;
  socialAccountId: UUID;
  capturedAt: ISO8601;
  followers: number;
  following: number;
  reach: number;
  impressions: number;
  profileVisits: number;
  interactions: number;
  websiteClicks: number;
  rawMetrics: JsonObject;
}

// ── Experiments ───────────────────────────────────────────────────────────────

export type ExperimentStatus = 'planned' | 'running' | 'concluded' | 'cancelled';
export type ExperimentVariant = 'control' | 'treatment';

export interface Experiment {
  id: UUID;
  socialAccountId: UUID;
  hypothesisId: UUID;
  name: string;
  variable: string;
  controlDefinition: string;
  treatmentDefinition: string;
  primaryMetric: PrimaryMetric;
  secondaryMetrics: PrimaryMetric[];
  startAt: ISO8601;
  endAt: ISO8601;
  status: ExperimentStatus;
  conclusion: string | null;
  confidence: number | null;
  createdAt: ISO8601;
}

export interface ExperimentAssignment {
  id: UUID;
  experimentId: UUID;
  contentIdeaId: UUID;
  variant: ExperimentVariant;
  createdAt: ISO8601;
}

// ── Agent / Orchestrator ──────────────────────────────────────────────────────

export type AgentRunType =
  | 'daily_cycle'
  | 'weekly_strategy'
  | 'monthly_review'
  | 'research'
  | 'content_generation'
  | 'analytics'
  | 'learning'
  | 'engagement'
  | 'publish';

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'waiting_approval';

export interface AgentStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  logs?: string[];
  timestamp: ISO8601;
}

export interface AgentRun {
  id: UUID;
  runType: AgentRunType;
  socialAccountId: UUID;
  status: AgentRunStatus;
  startedAt: ISO8601;
  completedAt: ISO8601 | null;
  inputSnapshot: JsonObject;
  output: JsonObject | null;
  error: { message: string; stack?: string } | null;
  progress?: AgentStep[];
  correlationId: string;
}

export type DecisionType =
  | 'GENERATE_CONTENT_PLAN'
  | 'REVISE_STRATEGY'
  | 'RUN_RESEARCH'
  | 'SCHEDULE_POST'
  | 'PUBLISH_POST'
  | 'CREATE_EXPERIMENT'
  | 'RECORD_INSIGHT'
  | 'SEND_NOTIFICATION'
  | 'BLOCK_AWAITING_APPROVAL'
  | 'UPDATE_CONTENT_MIX';

export interface AgentDecision {
  id: UUID;
  agentRunId: UUID;
  decisionType: DecisionType;
  decision: JsonObject;
  evidence: string[];
  confidence: number;
  reasoning: string;
  createdAt: ISO8601;
}

export type AgentState =
  | 'IDLE'
  | 'OBSERVING'
  | 'RESEARCHING'
  | 'PLANNING'
  | 'CREATING'
  | 'VALIDATING'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'MEASURING'
  | 'LEARNING'
  | 'REPLANNING'
  | 'AUTH_REQUIRED'
  | 'WAITING_APPROVAL'
  | 'RETRYING'
  | 'BLOCKED'
  | 'FAILED';

// ── Engagement ───────────────────────────────────────────────────────────────

export type CommentSentiment = 'positive' | 'neutral' | 'negative' | 'spam';
export type CommentIntent =
  | 'question'
  | 'appreciation'
  | 'complaint'
  | 'spam'
  | 'engagement'
  | 'other';
export type CommentStatus = 'new' | 'reviewed' | 'responded' | 'ignored' | 'escalated';

export interface Comment {
  id: UUID;
  socialAccountId: UUID;
  postId: UUID;
  platformCommentId: string;
  authorHandle: string;
  text: string;
  sentiment: CommentSentiment;
  intent: CommentIntent;
  riskLevel: RiskLevel;
  status: CommentStatus;
  createdAt: ISO8601;
}

export type EngagementActionType = 'reply' | 'like' | 'hide' | 'delete' | 'report';
export type EngagementActionStatus = 'draft' | 'pending_approval' | 'executed' | 'rejected';

export interface EngagementAction {
  id: UUID;
  commentId: UUID;
  actionType: EngagementActionType;
  draftText: string | null;
  executedText: string | null;
  status: EngagementActionStatus;
  policyDecision: PolicyDecision;
  createdAt: ISO8601;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'approval_required'
  | 'publish_failed'
  | 'auth_expired'
  | 'account_anomaly'
  | 'strategy_changed'
  | 'goal_milestone'
  | 'agent_blocked'
  | 'experiment_concluded'
  | 'agent_status_update';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'unread' | 'read' | 'actioned' | 'dismissed';

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  metadata: JsonObject;
  status: NotificationStatus;
  createdAt: ISO8601;
  readAt: ISO8601 | null;
}

// ── LLM Provider Types ────────────────────────────────────────────────────────

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  useStrongModel?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProviderName;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost?: number;
}

export interface StructuredLLMRequest<T> extends LLMRequest {
  schema: JsonObject;         // JSON Schema describing T
  schemaName: string;
}

export interface LLMUsageRecord {
  provider: LLMProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  taskType: string;
  agentRunId?: UUID;
  createdAt: ISO8601;
}

// ── Social Platform Adapter Types ─────────────────────────────────────────────

export interface SocialAccountInfo {
  platformAccountId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  followerCount: number;
  followingCount: number;
  mediaCount: number;
  biography: string | null;
}

export interface PublishInput {
  contentIdeaId: UUID;
  caption: string;
  mediaUrls: string[];
  mediaType: ContentFormat;
  scheduledAt?: ISO8601;
  idempotencyKey: string;
}

export interface PublishedPost {
  platformPostId: string;
  publishedAt: ISO8601;
  permalink: string | null;
}

export interface DateRange {
  since: ISO8601;
  until: ISO8601;
}

export type PublishStatus = 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED';

// ── Job / Queue Types ─────────────────────────────────────────────────────────

export type QueueName =
  | 'research'
  | 'strategy'
  | 'content-generation'
  | 'media-generation'
  | 'quality-check'
  | 'publishing'
  | 'analytics'
  | 'engagement'
  | 'learning'
  | 'notifications';

export interface BaseJobData {
  socialAccountId: UUID;
  agentRunId?: UUID;
  correlationId: string;
  idempotencyKey: string;
  attemptNumber: number;
  createdAt: ISO8601;
}

export interface PublishJobData extends BaseJobData {
  postId: UUID;
}

export interface AnalyticsJobData extends BaseJobData {
  postId?: UUID;
  captureType: 'account' | 'post' | 'post_batch';
}

export interface AgentCycleJobData extends BaseJobData {
  cycleType: 'daily' | 'weekly' | 'monthly';
}

// ── Scheduled Job (DB) ────────────────────────────────────────────────────────

export type ScheduledJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledJob {
  id: UUID;
  jobType: QueueName;
  payload: JsonObject;
  scheduledFor: ISO8601;
  status: ScheduledJobStatus;
  attempts: number;
  idempotencyKey: string;
  createdAt: ISO8601;
}

// ── API Response Wrappers ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: JsonObject;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: JsonValue;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── System Health ─────────────────────────────────────────────────────────────

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'BLOCKED' | 'AUTH_REQUIRED' | 'ERROR';

export interface SystemHealth {
  status: HealthStatus;
  timestamp: ISO8601;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    llm: ServiceHealth;
    instagram: ServiceHealth;
    storage: ServiceHealth;
  };
  agentState: AgentState;
  queueDepths: Record<QueueName, number>;
}

export interface ServiceHealth {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
}
