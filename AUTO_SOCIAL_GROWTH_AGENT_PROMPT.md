# Autonomous AI Social-Media Employee — Master Build Prompt

## 0. Role and Mission

You are a senior staff-level software architect and autonomous coding agent. Your task is to design and implement an **Autonomous AI Social-Media Employee** for a single owner/operator initially.

This is not a generic social-media scheduler and not primarily a SaaS product. It is a **personal autonomous growth system** whose purpose is to operate the owner's social-media account(s) like a competent full-time social-media strategist + content creator + analyst + community manager.

The system must be capable of:

1. Understanding an admin-defined growth goal.
2. Building and maintaining a persistent understanding of the account, brand, audience, niche, competitors, content history, and constraints.
3. Researching current trends, competitors, audience interests, content patterns, and relevant external information.
4. Creating a measurable social-media strategy.
5. Turning that strategy into an adaptive content plan/calendar.
6. Producing content assets and copy.
7. Choosing when and where to publish based on evidence and account history.
8. Publishing through official platform APIs wherever possible.
9. Collecting post-level and account-level analytics.
10. Diagnosing what worked, what failed, and what may have caused the outcome.
11. Running controlled experiments.
12. Updating the strategy and future content decisions based on observed results.
13. Managing engagement when supported by platform APIs, while applying strong safety/brand guardrails.
14. Operating repeatedly through scheduled autonomous cycles with minimal human intervention.
15. Maintaining an auditable record of every meaningful decision made by the system.

The most important design principle is:

> **The system should optimize toward the owner's business/social growth objective, not merely maximize posting frequency or generate content.**

The initial implementation is for one owner and one primary platform: **Instagram**. Design interfaces so additional platforms can be added later without rewriting the core agent system.

---

# 1. Product Definition

## Working Name

Use a neutral internal project name such as:

`autonomous-social-agent`

Do not spend time on branding, logos, billing, multi-tenant SaaS, or public marketing pages during V1.

## Product Concept

The system behaves like a virtual social-media employee with a continuous closed loop:

```text
ADMIN GOAL
   ↓
ACCOUNT / BRAND MEMORY
   ↓
RESEARCH
   ↓
STRATEGY
   ↓
CONTENT PLAN
   ↓
CONTENT CREATION
   ↓
QUALITY / SAFETY CHECK
   ↓
SCHEDULING
   ↓
PUBLISHING
   ↓
OBSERVATION / ANALYTICS
   ↓
PERFORMANCE ANALYSIS
   ↓
EXPERIMENTATION
   ↓
LEARNING / MEMORY UPDATE
   ↓
STRATEGY REVISION
   ↺
```

The loop must be persistent across days and weeks. Each run must use prior state and historical performance instead of behaving like a stateless chatbot.

---

# 2. Non-Goals for V1

Do NOT build these unless required by the architecture:

- Public SaaS signup and billing.
- Multi-tenant architecture.
- Complex role management beyond a single admin.
- Full social listening across every platform.
- Browser automation against social websites when an official API exists.
- Fake engagement, bots, follow/unfollow automation, mass DMs, or spam.
- Artificial likes/comments/follower purchasing.
- Automated behavior designed to evade platform safeguards.
- Fully autonomous actions that can cause reputational, financial, legal, or irreversible damage without guardrails.
- Heavy ML infrastructure before sufficient real-world data exists.

The system should be **API-first, measurable, observable, and progressively autonomous**.

---

# 3. Core Design Principles

## 3.1 Autonomous but bounded

The agent can make routine strategic and operational decisions, but every action must have an explicit risk level.

Suggested action classes:

### Low risk — fully autonomous
- Research.
- Generate internal strategy.
- Generate content drafts.
- Analyze analytics.
- Propose experiments.
- Select among pre-approved content pillars.
- Select a publishing time inside configured bounds.
- Publish standard content after all required checks pass.

### Medium risk — configurable approval
- New content pillar.
- Major brand voice change.
- New campaign concept.
- Replies to sensitive comments.
- Content involving claims, pricing, competitors, or potentially controversial subjects.

### High risk — approval required by default
- Deleting content.
- Paid promotions/ad spend.
- Legal/medical/financial claims.
- Political/controversial content.
- Public escalation or hostile replies.
- External communications with significant consequences.

Implement this as policy, not hard-coded scattered if/else statements.

## 3.2 LLM is a reasoning component, not the entire system

Use LLMs for:

- Semantic research synthesis.
- Strategy reasoning.
- Content ideation.
- Copy/script generation.
- Performance interpretation.
- Hypothesis generation.
- Strategic recommendations.

Use deterministic code/statistics for:

- Scheduling.
- Time-window calculations.
- KPI calculations.
- Aggregations.
- Rate limits.
- Retry logic.
- Idempotency.
- Thresholds.
- Experiment assignment.
- State transitions.
- Authorization.
- Safety policies.

Never ask an LLM to perform a calculation that should be deterministic.

## 3.3 Evidence over intuition

Every important strategy decision should carry:

- evidence used,
- assumptions,
- confidence,
- expected impact,
- decision,
- outcome after execution.

The system should distinguish between:

- observed facts,
- inferred insights,
- hypotheses,
- strategic decisions.

## 3.4 Never erase history

Do not overwrite strategic knowledge destructively. Use versioning/event history so the system can answer:

- What did we believe last month?
- Why did we change the content mix?
- Which experiment caused the change?
- Which strategy version produced this result?

---

# 4. Recommended Technical Architecture

Build a modular monolithic backend first, with clear module boundaries and asynchronous workers. Do NOT prematurely split into microservices.

## Suggested stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS or an existing equivalent styling system

### Backend
- Node.js
- TypeScript
- Express.js or Fastify

### Database
- PostgreSQL
- Native SQL or a lightweight typed query layer preferred over heavy ORM abstraction

### Queue / Async Processing
- Redis
- BullMQ

### Object Storage
Use S3-compatible storage or equivalent for generated media and content assets.

### LLM abstraction
Create a provider-independent `LLMProvider` interface so multiple models/providers can be configured.

Example:

```ts
interface LLMProvider {
  generateText(input: LLMRequest): Promise<LLMResponse>;
  generateStructured<T>(input: StructuredLLMRequest): Promise<T>;
  generateVision?(input: VisionRequest): Promise<VisionResponse>;
}
```

Support provider/model routing through configuration rather than hard-coding one vendor.

### Research provider
Create a provider abstraction for web/search/research APIs.

### Social platform provider
Create an interface:

```ts
interface SocialPlatformAdapter {
  getAccount(): Promise<SocialAccount>;
  publishPost(input: PublishInput): Promise<PublishedPost>;
  getPostInsights(postId: string): Promise<PostInsights>;
  getAccountInsights(range: DateRange): Promise<AccountInsights>;
  getComments?(postId: string): Promise<Comment[]>;
  replyToComment?(commentId: string, text: string): Promise<CommentReply>;
  getMediaStatus?(publishId: string): Promise<PublishStatus>;
}
```

Implement `InstagramAdapter` first.

Use official platform APIs/documented capabilities. Verify the current API capabilities, permissions, limitations, media formats, publishing behavior, insight availability, token lifecycle, webhooks, and rate limits from current official documentation during implementation. Do not invent API fields or capabilities.

---

# 5. High-Level System Components

Build these modules:

```text
/apps
  /web
  /api

/packages or /src/modules
  /agent
  /orchestrator
  /research
  /strategy
  /content
  /publishing
  /analytics
  /experiments
  /engagement
  /memory
  /policies
  /llm
  /social
  /scheduling
  /notifications
  /observability
  /common
```

The exact folder structure can differ, but equivalent module separation must exist.

---

# 6. Agent Architecture

Do NOT create dozens of independent LLM agents simply for the sake of calling them agents.

Use a small set of specialized logical agents/services coordinated by a central orchestrator.

## 6.1 Orchestrator Agent / Decision Engine

Responsibilities:

- Determine current objective.
- Inspect system state.
- Decide which autonomous workflow needs to run.
- Delegate work to specialized modules.
- Maintain run state.
- Respect policies and autonomy level.
- Stop when required information is missing.
- Retry transient failures through worker infrastructure.
- Record decisions.

The orchestrator should produce structured decisions, not free-form text.

Example:

```json
{
  "decision": "GENERATE_CONTENT_PLAN",
  "reason": "Current weekly plan is below target and educational reels have materially outperformed product posts.",
  "priority": "high",
  "evidenceIds": ["perf_123", "exp_44"],
  "confidence": 0.84
}
```

## 6.2 Research Agent

Gather and synthesize information relevant to growth.

Research sources may include:

- search/web APIs,
- public competitor content where permitted,
- trend data,
- own historical content,
- audience comments,
- platform analytics,
- niche news,
- relevant communities where access is legitimate.

Research questions should be generated from current strategic uncertainty, not just on a fixed schedule.

Example:

Instead of always asking:

> "What is trending today?"

ask:

> "Which content angles are currently gaining traction in this niche that overlap with our top-performing content themes?"

Research outputs must be structured and cite their sources internally.

## 6.3 Strategy Agent

Responsibilities:

- Translate admin goals into measurable objectives.
- Define content pillars.
- Define target audience hypotheses.
- Define content mix.
- Define cadence.
- Define experimentation roadmap.
- Define KPI hierarchy.
- Define constraints.
- Revise strategy based on outcomes.

Strategy must have versions.

Example structure:

```json
{
  "objective": {
    "primaryMetric": "qualified_profile_visits",
    "secondaryMetrics": ["reach", "shares", "follows"]
  },
  "contentMix": {
    "education": 0.40,
    "storytelling": 0.25,
    "trend": 0.15,
    "product": 0.10,
    "community": 0.10
  },
  "cadence": {
    "reelsPerWeek": 4,
    "carouselsPerWeek": 2,
    "storiesPerWeek": 5
  },
  "experiments": [
    "curiosity hooks",
    "first-2-second visual hooks"
  ]
}
```

## 6.4 Content Agent

Generate:

- post ideas,
- hooks,
- captions,
- scripts,
- CTAs,
- carousel outlines,
- short-form video concepts,
- asset briefs,
- alt text where appropriate.

For media generation, provide an abstraction so image/video models can be plugged in later.

Do not assume an LLM alone can generate the final media file.

## 6.5 Analytics Agent

Responsibilities:

- Pull metrics.
- Normalize metrics.
- Compare against historical baselines.
- Detect anomalies.
- Segment by format/topic/hook/time.
- Calculate derived KPIs.
- Attribute outcomes where feasible.

Do not overclaim causality from observational data.

## 6.6 Learning / Optimization Agent

Responsibilities:

- Identify patterns.
- Evaluate hypotheses.
- Update confidence scores.
- Propose strategy changes.
- Retire weak tactics.
- Promote successful tactics.

Store learning as structured knowledge, e.g.:

```json
{
  "insight": "Tutorial reels outperform product-only reels on shares.",
  "scope": "instagram_account",
  "evidence": ["post_11", "post_14", "post_19"],
  "confidence": 0.78,
  "status": "active",
  "createdAt": "..."
}
```

## 6.7 Engagement Agent

Initially support safe operations only:

- collect comments,
- classify comments,
- identify questions needing response,
- draft response,
- optionally auto-publish low-risk replies according to policy.

Never auto-respond aggressively or fabricate facts.

---

# 7. Account / Brand Memory

The agent needs persistent memory.

Create a structured `AccountProfile` containing at least:

- account metadata,
- niche,
- value proposition,
- target audience,
- geographic focus,
- language,
- tone/voice,
- banned topics,
- allowed topics,
- business goals,
- conversion goals,
- visual preferences,
- competitor set,
- content pillars,
- known winning patterns,
- known losing patterns,
- preferred CTA patterns,
- publishing constraints,
- approval policy.

Store long-term knowledge in PostgreSQL. Add vector search only when useful; do not introduce a vector database solely because the product uses LLMs.

Use short-term run context separately from durable strategic memory.

---

# 8. Database Design

Create migrations for at least these entities.

## Core

### users
- id
- email
- name
- role
- created_at
- updated_at

### social_accounts
- id
- platform
- platform_account_id
- username
- display_name
- access_token_encrypted / secure token reference
- token_expires_at
- connection_status
- metadata_json
- created_at
- updated_at

### account_profiles
- id
- social_account_id
- niche
- audience_definition
- brand_voice
- goals_json
- constraints_json
- visual_guidelines_json
- created_at
- updated_at

## Strategy

### strategy_versions
- id
- social_account_id
- version_number
- objective_json
- content_mix_json
- cadence_json
- experiment_plan_json
- rationale
- evidence_ids_json
- confidence
- status
- created_at

### strategic_insights
- id
- social_account_id
- category
- statement
- evidence_json
- confidence
- scope
- status
- created_at
- updated_at

### hypotheses
- id
- strategy_version_id
- statement
- metric
- expected_direction
- expected_effect
- status
- created_at

## Research

### research_runs
- id
- social_account_id
- query_json
- source_data_json
- synthesized_findings_json
- created_at

### research_sources
- id
- research_run_id
- source_url
- title
- domain
- fetched_at
- excerpt_or_summary
- credibility_notes

## Content

### content_ideas
- id
- social_account_id
- strategy_version_id
- pillar
- format
- concept
- hook
- rationale
- score
- status
- created_at

### content_assets
- id
- content_idea_id
- asset_type
- storage_url
- metadata_json
- generation_metadata_json
- created_at

### posts
- id
- social_account_id
- content_idea_id
- platform_post_id
- caption
- media_type
- scheduled_at
- published_at
- status
- strategy_version_id
- experiment_id
- created_at
- updated_at

## Analytics

### post_metrics
- id
- post_id
- captured_at
- impressions
- reach
- views
- likes
- comments
- shares
- saves
- profile_visits
- follows
- clicks
- watch_time
- retention_json
- raw_metrics_json

### account_metrics
- id
- social_account_id
- captured_at
- followers
- following
- reach
- impressions
- profile_visits
- interactions
- website_clicks
- raw_metrics_json

## Experiments

### experiments
- id
- social_account_id
- hypothesis_id
- name
- variable
- control_definition
- treatment_definition
- primary_metric
- secondary_metrics_json
- start_at
- end_at
- status
- conclusion
- confidence

### experiment_assignments
- id
- experiment_id
- content_idea_id
- variant

## Agent execution

### agent_runs
- id
- run_type
- social_account_id
- status
- started_at
- completed_at
- input_snapshot_json
- output_json
- error_json

### agent_decisions
- id
- agent_run_id
- decision_type
- decision_json
- evidence_json
- confidence
- created_at

### scheduled_jobs
- id
- job_type
- payload_json
- scheduled_for
- status
- attempts
- idempotency_key

## Engagement

### comments
- id
- social_account_id
- post_id
- platform_comment_id
- author_handle
- text
- sentiment
- intent
- risk_level
- status
- created_at

### engagement_actions
- id
- comment_id
- action_type
- draft_text
- executed_text
- status
- policy_decision
- created_at

---

# 9. Admin Goal Model

Provide a UI/API through which the owner can define the growth objective.

Example:

```json
{
  "goalType": "GROW_ACCOUNT",
  "primaryMetric": "followers",
  "target": 10000,
  "deadline": "2027-03-01",
  "audience": "...",
  "businessOutcome": "...",
  "platform": "instagram",
  "autonomyLevel": "supervised",
  "constraints": {
    "maxPostsPerDay": 2,
    "noPolitics": true,
    "noControversialContent": true,
    "approvedTone": ["educational", "practical", "credible"]
  }
}
```

The system should derive operational objectives from this goal.

Do not assume follower growth is always the optimal primary metric. Support a KPI hierarchy and let the admin configure it.

---

# 10. Autonomous Operating Cycles

Implement recurring cycles.

## Daily cycle

Suggested default workflow:

```text
1. Load account state.
2. Pull fresh analytics.
3. Pull comments / engagement signals if available.
4. Detect meaningful changes.
5. Determine whether fresh research is needed.
6. Run targeted research.
7. Evaluate current strategy.
8. Decide today's actions.
9. Generate or revise content plan.
10. Generate assets/copy.
11. Run quality + safety checks.
12. Schedule/publish permitted content.
13. Record decisions.
```

## Weekly strategy cycle

```text
1. Aggregate last 7–14 days performance.
2. Compare strategy version vs baseline.
3. Evaluate experiments.
4. Identify winning/losing topics, hooks, formats, lengths, and time windows.
5. Update strategic insights.
6. Create a new strategy version when evidence supports a change.
7. Generate next week's content plan.
```

## Monthly review cycle

Provide a deeper review:

- growth trajectory,
- strategic shifts,
- content economics if known,
- sustained winners,
- repeated failures,
- audience evolution,
- goals vs actual,
- next-month recommendations.

---

# 11. Research Engine

The research engine must be goal-directed.

Implement these research categories:

### Trend research
Identify relevant emerging topics, formats, hooks, conversations, and themes.

### Competitor research
Analyze selected competitor accounts where legally and technically permitted.

Track:

- posting cadence,
- content format,
- recurring themes,
- engagement patterns,
- hooks,
- content structure.

Do not scrape protected/private data or violate platform terms.

### Audience research
Use available comments, questions, search results, and other legitimate sources to infer audience pain points and interests.

### Content research
Find examples relevant to current strategy hypotheses.

### Research freshness
Store timestamps and source metadata. Research should expire and be refreshed when stale.

---

# 12. Content Strategy Engine

Do not generate a random content calendar.

Every content item should map to:

```text
Goal
 ↓
Strategy pillar
 ↓
Audience problem / desire
 ↓
Content angle
 ↓
Format
 ↓
Hook
 ↓
Body / structure
 ↓
CTA
 ↓
Experiment
```

Each content item should include a structured rationale.

Example:

```json
{
  "goal": "reach_new_audience",
  "pillar": "education",
  "audiencePain": "Founders struggle to understand why their reels stall.",
  "angle": "3 retention mistakes",
  "format": "reel",
  "hook": "Your Reel may be losing people in the first 2 seconds.",
  "cta": "Save this before your next Reel.",
  "experiment": "curiosity_hook_v2"
}
```

---

# 13. Content Scoring

Before publishing, score candidate posts on deterministic and LLM-derived dimensions.

Suggested dimensions:

- strategy alignment,
- audience relevance,
- novelty,
- expected reach potential,
- expected engagement potential,
- brand alignment,
- evidence strength,
- production cost,
- risk.

Example aggregate:

```text
contentScore = weighted combination of:
  strategyFit
  audienceFit
  evidenceStrength
  novelty
  predictedEngagement
  predictedReach
  brandSafety
```

Do not let an LLM directly decide final publication merely from prose. Convert important criteria into structured fields.

---

# 14. Scheduling Intelligence

The scheduler must evolve based on data.

Start with a simple statistical model:

- historical performance by weekday,
- hour/time window,
- content format,
- content pillar,
- audience timezone.

Then choose the best eligible window.

Do not overfit early data. Use exploration/exploitation logic.

A simple initial approach:

```text
70–85% exploit known strong windows
15–30% explore alternative windows
```

Make the ratio configurable.

As data accumulates, move to a more sophisticated contextual bandit or similar approach only if justified by the dataset.

Do not build a complex ML model before there is enough historical data.

---

# 15. Analytics and Growth Intelligence

At minimum track:

### Account metrics
- follower count
- follower growth
- reach
- impressions
- profile visits
- interactions
- clicks if available

### Content metrics
- reach
- impressions
- views
- likes
- comments
- shares
- saves
- watch time
- retention
- profile visits
- follower conversion

Derived metrics should include, where data permits:

- engagement rate,
- share rate,
- save rate,
- comment rate,
- profile-visit rate,
- follow conversion rate,
- median vs mean performance,
- performance vs account baseline.

Always preserve raw API metrics separately from normalized metrics.

---

# 16. Attribution and Causality Guardrails

Do not claim:

> "This hook caused 40% more reach"

when the system only knows that one post performed better.

Instead use language such as:

> "This hook is associated with higher reach in the current sample. Confidence is medium."

When possible, use experiments to estimate causal effects.

---

# 17. Experimentation Engine

This is a first-class feature, not an afterthought.

Every week the system should identify 1–3 meaningful hypotheses.

Examples:

- curiosity hooks outperform descriptive hooks,
- shorter intros improve retention,
- educational carousels generate more saves,
- posting at 7 PM improves profile visits,
- founder-story posts generate more follows.

For every experiment store:

```text
Hypothesis
 ↓
Independent variable
 ↓
Variants
 ↓
Primary metric
 ↓
Secondary metrics
 ↓
Observation window
 ↓
Result
 ↓
Confidence
 ↓
Strategic decision
```

Do not run experiments with too many simultaneous variables when that prevents meaningful interpretation.

---

# 18. Quality and Safety Pipeline

Before every automated publication:

```text
Generated content
      ↓
Brand voice check
      ↓
Factuality check
      ↓
Policy / platform safety check
      ↓
Sensitive-topic check
      ↓
Duplicate / near-duplicate check
      ↓
Spam / repetition check
      ↓
Media validation
      ↓
Approval policy
      ↓
Publish
```

Create a `PolicyEngine` that returns structured output.

Example:

```json
{
  "decision": "ALLOW",
  "risk": "low",
  "reasons": [],
  "requiresApproval": false
}
```

For uncertain cases:

```json
{
  "decision": "REVIEW",
  "risk": "medium",
  "reasons": ["Contains an unsupported factual claim"],
  "requiresApproval": true
}
```

---

# 19. Idempotency, Reliability, and Job Semantics

The system will interact with external APIs and queues, so design carefully.

Every externally visible operation must have an idempotency strategy.

Examples:

- Do not publish the same post twice if a worker retries.
- Do not duplicate analytics records unnecessarily.
- Do not create duplicate strategy versions after a retry.
- Do not double-reply to a comment.

Use idempotency keys such as:

```text
publish:{socialAccountId}:{contentId}:{scheduledSlot}
analytics:{socialAccountId}:{platformPostId}:{captureTimeBucket}
engagement:{platformCommentId}:{actionType}
```

Workers must distinguish:

- transient errors,
- permanent errors,
- authentication errors,
- rate-limit errors,
- validation errors.

Implement exponential backoff where appropriate.

---

# 20. Queue Architecture

Use BullMQ for asynchronous work.

Suggested queues:

```text
research
strategy
content-generation
media-generation
quality-check
publishing
analytics
engagement
learning
notifications
```

Use separate worker processors where useful, but keep deployment simple.

Each job should contain:

- job type,
- entity ID,
- correlation ID,
- idempotency key,
- attempt number,
- created timestamp.

---

# 21. Scheduling Model

Use a scheduler that creates future jobs rather than embedding infinite loops in worker processes.

Example:

```text
Scheduler
  ↓
Create BullMQ delayed job
  ↓
Worker picks job
  ↓
Execute
  ↓
Record state
  ↓
Schedule next dependent job
```

This allows recovery after restarts.

---

# 22. LLM Prompting Architecture

Do not scatter giant prompts across application code.

Create versioned prompt templates.

Each prompt should define:

- role,
- objective,
- available context,
- allowed actions,
- forbidden assumptions,
- output schema,
- evidence requirements,
- confidence requirement.

Use structured JSON outputs whenever possible.

Example strategy prompt concept:

```text
You are the strategy agent for one social account.

Objective:
{goal}

Current strategy:
{strategy}

Historical performance:
{analytics}

Recent experiments:
{experiments}

Research:
{research}

Constraints:
{constraints}

Tasks:
1. Evaluate current strategy.
2. Identify evidence-backed opportunities.
3. Identify underperforming tactics.
4. Propose changes only when evidence supports them.
5. Propose experiments for unresolved uncertainty.
6. Return a structured strategy update.

Rules:
- Do not invent analytics.
- Distinguish observation from inference.
- State confidence.
- Do not optimize for vanity metrics when the configured goal uses a different primary KPI.
```

Prompts should be stored in code/config with versions.

---

# 23. LLM Cost Control

The system should be economical.

Implement:

- model routing,
- caching where safe,
- structured prompts,
- summarization of old context,
- deterministic preprocessing,
- low-cost models for classification/extraction,
- stronger models for difficult strategic reasoning.

Do not send the entire database history to an LLM on every run.

Construct a compact context package containing only decision-relevant state.

---

# 24. Memory Architecture

Use three layers.

## Short-term memory
Current run context:

- current task,
- current research,
- recent analytics,
- current strategy.

## Episodic memory
Historical events:

- published post,
- experiment result,
- strategy change,
- significant audience event.

## Semantic strategic memory
Learned knowledge:

- high-performing hooks,
- winning content themes,
- audience pain points,
- best publishing windows,
- failed tactics,
- policy constraints.

The agent should query memory selectively.

---

# 25. Decision Trace / Auditability

For every significant autonomous decision store:

```text
Goal
 ↓
Context snapshot
 ↓
Evidence
 ↓
Decision
 ↓
Reasoning summary
 ↓
Confidence
 ↓
Action
 ↓
Result
```

Do not store hidden chain-of-thought or private reasoning. Store concise decision rationales and evidence references suitable for auditing.

Example dashboard entry:

> Switched from 30% product content to 15% because educational reels generated 2.4× the median share rate over the last 12 posts. Confidence: medium.

---

# 26. Admin Dashboard

The dashboard should initially expose:

## Overview
- follower growth,
- reach,
- engagement,
- posts published,
- current goal progress,
- upcoming posts.

## Agent Status
- current strategy,
- latest autonomous decision,
- current task,
- next scheduled task,
- recent errors.

## Content Calendar
- scheduled,
- published,
- failed,
- review-needed.

## Strategy
- current strategy version,
- content mix,
- active experiments,
- strategic insights.

## Analytics
- post performance,
- format comparison,
- topic comparison,
- time-of-day comparison,
- growth trends.

## Research
- recent research runs,
- key findings,
- sources.

## Autonomy Controls
- autonomy level,
- approval rules,
- content frequency limits,
- platform connections.

## Decision Log
- what agent decided,
- when,
- why,
- evidence,
- resulting action.

The UI should be operational, not decorative.

---

# 27. Notification System

Create notifications for:

- approval required,
- publishing failure,
- authentication expiry,
- unusual account anomaly,
- strategy change of significance,
- important goal milestone,
- agent blocked by a missing dependency.

Initially support one simple notification channel such as email or in-app notification. Keep it abstract for future integrations.

---

# 28. Observability

Implement from the beginning:

- structured logging,
- correlation IDs,
- agent run IDs,
- job IDs,
- API request logs,
- LLM latency and token/cost metadata where available,
- queue metrics,
- error tracking.

Add an internal system-health page.

Useful statuses:

```text
HEALTHY
DEGRADED
BLOCKED
AUTH_REQUIRED
ERROR
```

---

# 29. Security Requirements

Treat social access tokens and API credentials as secrets.

Requirements:

- Never hard-code secrets.
- Encrypt sensitive tokens at rest or use a secure secret mechanism.
- Never print secrets in logs.
- Validate OAuth state/redirect flows.
- Apply least-privilege permissions.
- Validate all webhook signatures where applicable.
- Sanitize external content before displaying it in the admin dashboard.
- Protect admin endpoints with authentication.
- Keep internal agent tools capability-scoped.

Never allow arbitrary LLM-generated tool calls without schema validation and policy checks.

---

# 30. Tool System

Expose agent tools as typed functions rather than letting the LLM invent arbitrary HTTP requests.

Examples:

```text
search_web(query)
get_account_metrics(range)
get_post_metrics(postId)
get_recent_posts(limit)
get_comments(postId)
create_content_idea(input)
generate_caption(input)
generate_script(input)
create_content_asset(input)
schedule_post(input)
publish_post(input)
create_experiment(input)
get_strategy()
update_strategy(input)
record_insight(input)
```

Each tool must have:

- JSON schema,
- authorization policy,
- risk level,
- idempotency rules where needed,
- validation,
- structured result.

---

# 31. Agent State Machine

Implement explicit state rather than relying entirely on LLM memory.

Example states:

```text
IDLE
↓
OBSERVING
↓
RESEARCHING
↓
PLANNING
↓
CREATING
↓
VALIDATING
↓
SCHEDULED
↓
PUBLISHED
↓
MEASURING
↓
LEARNING
↓
REPLANNING
```

Error/recovery states:

```text
AUTH_REQUIRED
WAITING_APPROVAL
RETRYING
BLOCKED
FAILED
```

Transitions should be represented in code.

---

# 32. V1 Instagram Scope

Implement these capabilities first, subject to current official API support:

### Connection
- connect an Instagram professional account through the supported Meta authentication flow,
- store account metadata,
- manage token lifecycle.

### Publishing
- publish supported media types,
- schedule future publishing through our own scheduler,
- record platform IDs,
- handle publishing status.

### Analytics
- retrieve account insights where supported,
- retrieve media/post insights where supported,
- normalize the data,
- store raw payloads for debugging.

### Engagement
- read comments where permitted,
- classify comments,
- draft responses,
- optionally auto-reply low-risk comments based on policy.

### Research
- use legitimate external research sources to gather trend and competitor context.

Do NOT implement browser-based Instagram login automation or password-based account control.

---

# 33. Content Asset Strategy

For V1, support at least:

1. text/caption generation,
2. image asset generation through a provider abstraction,
3. simple carousel asset generation,
4. reusable templates.

Video generation can initially be represented as a pluggable provider; do not block the rest of the architecture on expensive video-generation infrastructure.

Store:

- prompt,
- model/provider,
- generated asset path,
- dimensions,
- MIME type,
- generation timestamp,
- content linkage.

---

# 34. Initial Autonomy Modes

Implement three modes.

## Manual
Agent prepares strategy/content/schedule but does not publish.

## Supervised
Agent automatically executes low-risk actions; owner approves medium-risk actions.

## Autonomous
Agent executes all permitted low-risk/medium-risk actions according to policy.

Default V1 should be **Supervised**.

The architecture must allow switching to Autonomous after confidence has been established.

---

# 35. Example End-to-End Scenario

The system starts with:

```text
Goal:
Grow Instagram from 0 to 10,000 followers by a target date.

Audience:
Indian ecommerce founders.

Tone:
Practical, credible, concise.

Constraints:
No fake claims, no political content, no aggressive engagement.
```

The agent should:

### Step 1
Analyze current account and baseline.

### Step 2
Research competitors and relevant niche trends.

### Step 3
Create strategy version 1.

Example:

```text
40% education
25% stories/case studies
15% trends
10% opinion
10% product/CTA
```

### Step 4
Generate a 7-day content plan.

### Step 5
Create content assets.

### Step 6
Score and validate them.

### Step 7
Schedule based on available evidence.

### Step 8
Publish.

### Step 9
Collect performance metrics at defined intervals.

### Step 10
Compare performance to the account baseline.

### Step 11
Notice:

```text
Educational reels:
2.3× median share rate

Case-study carousels:
1.8× median save rate

Product posts:
0.6× median reach
```

### Step 12
Create insight:

> Educational and case-study formats currently outperform product-heavy posts.

### Step 13
Revise next strategy version.

### Step 14
Create an experiment around hook type.

### Step 15
Repeat.

This loop must work without requiring the owner to manually tell the agent what to do every morning.

---

# 36. APIs and External Services

Use abstraction layers around all external services.

Minimum categories:

```text
LLM Provider
Search / Research Provider
Instagram / Meta API
Media Generation Provider
Object Storage
Notification Provider
```

All credentials should be configured through environment variables or secure secrets.

Create `.env.example` with placeholders only.

Document the exact current platform setup required in `docs/INTEGRATIONS.md`.

Before implementation, consult and follow current official platform documentation. Do not rely on outdated examples from random blogs for OAuth scopes, permissions, publishing endpoints, insight fields, or rate limits.

---

# 37. Development Workflow

Implement iteratively.

## Phase 0 — Repository foundation

- setup monorepo or clean modular repo,
- TypeScript strict mode,
- linting,
- formatting,
- env validation,
- Docker for local Postgres/Redis,
- migration system,
- test framework,
- basic CI.

## Phase 1 — Core domain and dashboard

Build:

- authentication,
- admin dashboard shell,
- account profile,
- goal management,
- database schema,
- audit logging.

## Phase 2 — Instagram integration

Build:

- OAuth connection,
- account sync,
- publish flow,
- token handling,
- basic analytics ingestion.

## Phase 3 — Agent framework

Build:

- orchestrator,
- tool schemas,
- agent run persistence,
- strategy agent,
- research agent.

## Phase 4 — Content pipeline

Build:

- content ideas,
- generation,
- quality checks,
- scheduling,
- publishing queue.

## Phase 5 — Learning loop

Build:

- metrics collection,
- performance analysis,
- strategic insights,
- experiment engine,
- strategy versioning.

## Phase 6 — Engagement

Build:

- comment ingestion,
- classification,
- response drafts,
- policy-based auto-replies.

## Phase 7 — Autonomy hardening

Build:

- risk policy engine,
- approval workflows,
- anomaly protection,
- stronger observability,
- recovery mechanisms.

Do not attempt Phase 7 before Phase 5 demonstrably works.

---

# 38. Required Project Documentation

Create:

```text
README.md
ARCHITECTURE.md
AGENT_DESIGN.md
DATA_MODEL.md
INTEGRATIONS.md
AUTONOMY_POLICY.md
OPERATIONS.md
PROMPTS.md
TESTING.md
ROADMAP.md
```

README must explain local setup and how to run the system end-to-end.

ARCHITECTURE must include Mermaid diagrams.

AGENT_DESIGN must document the agents, tools, state machine, and decision loop.

AUTONOMY_POLICY must clearly document which actions are fully autonomous vs approval-required.

---

# 39. Testing Requirements

Do not rely only on unit tests.

Implement:

### Unit tests
- KPI calculations,
- scheduling logic,
- scoring,
- policy evaluation,
- state transitions,
- idempotency helpers.

### Integration tests
- PostgreSQL repositories,
- Redis/BullMQ jobs,
- LLM adapter mocking,
- social adapter mocking.

### End-to-end tests
Test a full simulated loop:

```text
Goal
→ research
→ strategy
→ content
→ schedule
→ simulated publish
→ simulated analytics
→ learning
→ strategy revision
```

### Failure tests
Simulate:

- expired access token,
- API timeout,
- rate limiting,
- duplicate worker execution,
- invalid media,
- LLM malformed response,
- publishing failure after job retry,
- partial analytics response.

The agent should recover gracefully.

---

# 40. Deterministic Simulation Mode

This is mandatory for development.

Create a simulation environment where Instagram is replaced by a fake adapter.

The simulator should allow synthetic post performance such as:

```json
{
  "reach": 12000,
  "shares": 330,
  "saves": 410,
  "follows": 96
}
```

This allows the strategy/learning loop to be tested without harming a real account.

---

# 41. Evaluation Framework

Create a local evaluation suite for agent decisions.

Evaluate whether the agent:

- follows the configured goal,
- uses evidence correctly,
- avoids fabricating metrics,
- respects constraints,
- makes consistent decisions,
- avoids unnecessary strategy changes,
- recognizes failed experiments,
- improves strategy when evidence supports it,
- avoids spam/repetition.

Track an internal quality score, but never let the system optimize solely for the evaluator.

---

# 42. Anti-Patterns to Avoid

Do NOT build:

### Anti-pattern 1
A chatbot with a “Post” button and call it an agent.

### Anti-pattern 2
A scheduler with an LLM wrapper.

### Anti-pattern 3
A system that generates unlimited content without measuring outcomes.

### Anti-pattern 4
A system that changes strategy every day based on tiny sample sizes.

### Anti-pattern 5
A system that blindly copies competitor content.

### Anti-pattern 6
A system that treats follower count as the only KPI.

### Anti-pattern 7
A system that stores no state and repeatedly forgets prior learning.

### Anti-pattern 8
A system that uses browser automation for actions that should go through official APIs.

### Anti-pattern 9
A system with no audit trail.

### Anti-pattern 10
A system that lets the LLM make arbitrary tool/API calls without validation or permissions.

---

# 43. Definition of Done for V1

V1 is complete only when the following end-to-end flow works:

```text
Admin connects Instagram
        ↓
Admin defines growth goal
        ↓
System builds account profile
        ↓
Research agent gathers initial context
        ↓
Strategy agent creates strategy v1
        ↓
Content agent creates a 7-day plan
        ↓
Assets/copy are generated
        ↓
Quality/policy layer validates them
        ↓
Scheduler selects times
        ↓
System publishes through official API
        ↓
Analytics worker collects results
        ↓
Analytics agent evaluates outcomes
        ↓
Learning engine records insights
        ↓
Strategy agent revises strategy when justified
        ↓
Next content plan reflects learning
```

The owner should be able to inspect the entire chain from the dashboard.

---

# 44. Initial Deliverables Expected from the Coding Agent

Before writing large quantities of code, produce:

1. Architecture proposal.
2. Repository/file structure.
3. Database ERD.
4. Mermaid sequence diagram for the autonomous loop.
5. Mermaid diagram for Instagram publishing flow.
6. Agent/tool matrix.
7. Risk/autonomy matrix.
8. Environment variable specification.
9. Milestone plan.
10. Implementation order.

Then begin implementation.

Do not stop after producing documentation. Continue through the implementation milestones unless blocked by a genuinely external dependency.

---

# 45. Coding Rules for the AI Coding Agent

Follow these rules strictly:

1. Inspect the existing repository before changing anything.
2. Preserve existing working functionality.
3. Prefer incremental commits/changes with coherent boundaries.
4. Use strong typing.
5. Avoid `any` unless unavoidable and justified.
6. Validate external input.
7. Keep business logic out of controllers where possible.
8. Use repositories/services/adapters with clear responsibility.
9. Never embed secrets.
10. Add tests with meaningful behavior coverage.
11. Add structured logging for autonomous operations.
12. Make external integrations replaceable through interfaces.
13. Make LLM outputs schema-validated.
14. Record all significant agent decisions.
15. Make jobs idempotent.
16. Design for retries.
17. Keep migrations reversible where practical.
18. Do not overengineer infrastructure before the core loop works.
19. Prefer a modular monolith over premature microservices.
20. When current API behavior is uncertain, verify against current official documentation before coding.

---

# 46. Required First Task

Before implementing the full project, inspect the repository and determine:

- what already exists,
- what stack is already in use,
- what can be reused,
- what should be refactored,
- what is missing.

Then create:

```text
/docs/IMPLEMENTATION_PLAN.md
```

with:

- current-state assessment,
- proposed architecture,
- phased implementation plan,
- assumptions,
- external dependencies,
- risks,
- unresolved API questions.

After that, start with the smallest vertical slice that can prove the core loop.

The first meaningful milestone should be:

```text
Goal
→ Strategy
→ Content idea
→ Simulated publish
→ Simulated analytics
→ Learning
→ Revised strategy
```

Use simulation before connecting destructive/real publishing actions.

---

# 47. The Core Product Principle

Keep this principle visible in the repository documentation:

> **This system is not successful because it can generate good posts. It is successful when it can repeatedly make better decisions about what to post, why to post it, when to post it, how to measure it, and what to change next—while moving the account toward the owner's defined goal.**

Build the system around that loop.

Do not reduce the project to a content generator.

Do not reduce the project to a scheduler.

Do not reduce the project to an analytics dashboard.

Build the complete closed-loop autonomous growth system.
