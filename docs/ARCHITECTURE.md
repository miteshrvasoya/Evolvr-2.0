# Evolvr — Architecture

> Last updated: September 2026 | Version: 0.1.0

---

## Overview

Evolvr is a **modular monolithic backend** with a Next.js dashboard frontend, connected by a typed REST API. The system's intelligence lives in a set of specialized agent modules coordinated by a central orchestrator, all backed by persistent PostgreSQL state and asynchronous BullMQ workers.

### Core Architecture Principle

```
The LLM is a reasoning component inside a larger deterministic system.
Deterministic code handles: scheduling, KPI calculations, state transitions,
rate limits, retries, idempotency, policy enforcement, authorization.
LLMs handle: synthesis, reasoning, generation, interpretation, hypothesis generation.
```

---

## System Diagram

```mermaid
graph TB
    subgraph Dashboard["Admin Dashboard (Next.js 14)"]
        UI[React Server Components]
        API_ROUTES[Next.js API Routes]
    end

    subgraph Backend["API Server (Fastify)"]
        ROUTES[REST API Routes]
        AUTH[Auth Middleware]
        ORCH[Orchestrator Agent]
        POLICY[Policy Engine]

        subgraph Agents["Agent Modules"]
            RESEARCH[Research Agent]
            STRATEGY[Strategy Agent]
            CONTENT[Content Agent]
            ANALYTICS[Analytics Agent]
            LEARNING[Learning / Optimization Agent]
            ENGAGEMENT[Engagement Agent]
        end

        subgraph Workers["BullMQ Workers"]
            W_RESEARCH[Research Worker]
            W_STRATEGY[Strategy Worker]
            W_CONTENT[Content-Gen Worker]
            W_MEDIA[Media-Gen Worker]
            W_QC[Quality-Check Worker]
            W_PUBLISH[Publishing Worker]
            W_ANALYTICS[Analytics Worker]
            W_ENGAGE[Engagement Worker]
            W_LEARN[Learning Worker]
            W_NOTIFY[Notifications Worker]
        end
    end

    subgraph Providers["External Providers"]
        LLM["LLM Provider\n(OpenRouter / Gemini / OpenAI / Anthropic)"]
        SEARCH["Research Provider\n(Serper / Tavily)"]
        META["Instagram Graph API\n(Meta)"]
        STORAGE["Object Storage\n(Local / S3 / R2)"]
    end

    subgraph Infra["Infrastructure"]
        POSTGRES[(PostgreSQL 16)]
        REDIS[(Redis 7)]
    end

    UI --> API_ROUTES
    API_ROUTES --> ROUTES
    ROUTES --> AUTH
    AUTH --> ORCH
    ORCH --> POLICY
    ORCH --> Agents
    Agents --> Workers
    Workers --> REDIS
    Workers --> POSTGRES
    Workers --> LLM
    Workers --> SEARCH
    Workers --> META
    Workers --> STORAGE
    ROUTES --> POSTGRES
```

---

## Autonomous Closed Loop

```mermaid
flowchart TD
    GOAL[Admin Goal] --> MEMORY[Account / Brand Memory]
    MEMORY --> RESEARCH[Research Engine]
    RESEARCH --> STRATEGY[Strategy Agent]
    STRATEGY --> PLAN[Content Plan]
    PLAN --> CREATION[Content Creation]
    CREATION --> QC[Quality & Safety Check]
    QC --> SCHEDULE[Scheduling Intelligence]
    SCHEDULE --> PUBLISH[Publishing Worker]
    PUBLISH --> OBSERVE[Analytics Collection]
    OBSERVE --> ANALYSIS[Performance Analysis]
    ANALYSIS --> EXPERIMENTS[Experimentation Engine]
    EXPERIMENTS --> LEARNING[Learning Engine]
    LEARNING --> STRATEGY

    style GOAL fill:#4f46e5,color:#fff
    style LEARNING fill:#059669,color:#fff
    style QC fill:#dc2626,color:#fff
```

---

## Module Responsibilities

### Orchestrator (`/modules/agent/orchestrator`)
- Determines current objective from admin goal and account state
- Inspects system state across all modules
- Decides which autonomous workflows need to run
- Delegates to specialized agents/workers
- Maintains agent run state
- Enforces policy and autonomy level
- Records all significant decisions

### Research Module (`/modules/research`)
- Goal-directed research (not just "what's trending")
- Categories: trend, competitor, audience, content, platform_update
- Research questions generated from current strategic uncertainty
- All findings structured with source attribution
- Research freshness management (expire + refresh stale data)

### Strategy Module (`/modules/strategy`)
- Translates admin goals into measurable objectives
- Defines content pillars, mix, cadence, KPI hierarchy
- Maintains versioned strategy history
- Revises strategy only when evidence supports changes
- Manages experiment hypotheses

### Content Module (`/modules/content`)
- Generates ideas mapped to: goal → pillar → audience pain → angle → format → hook → CTA
- Multi-dimension scoring (strategy fit, audience fit, novelty, predicted reach/engagement, brand safety)
- Caption, script, and carousel outline generation
- Asset brief generation (for media providers)

### Policy Engine (`/modules/policies`)
- Implements risk classification for every action
- Returns structured `PolicyDecision` (ALLOW / REVIEW / BLOCK)
- Checks: brand voice, factuality, sensitive topics, duplicates, spam, media validity
- Respects configured autonomy mode (Manual / Supervised / Autonomous)

### Publishing Module (`/modules/publishing`)
- Idempotent publishing worker
- Handles two-step Instagram container publish flow
- Exponential backoff on failures
- Records platform post IDs
- Schedules follow-up analytics collection jobs

### Analytics Module (`/modules/analytics`)
- Pulls account and post metrics from platform API
- Normalizes raw metrics
- Computes derived KPIs (engagement rate, save rate, etc.)
- Compares against historical baselines
- Detects anomalies
- Preserves raw API payloads

### Experiments Module (`/modules/experiments`)
- Creates controlled experiments (1 variable at a time)
- Assigns content ideas to control/treatment variants
- Measures outcomes at experiment end
- Updates hypothesis status (confirmed/rejected)
- Feeds conclusions into learning engine

### Learning Module (`/modules/learning`)
- Identifies performance patterns
- Updates insight confidence scores
- Proposes strategy changes (with evidence threshold)
- Promotes winning tactics, retires weak ones
- All knowledge stored as structured `StrategicInsight` records

### Engagement Module (`/modules/engagement`)
- Ingests comments from platform
- Classifies by sentiment, intent, risk
- Drafts contextual responses
- Auto-replies low-risk comments per policy (if enabled)
- Never fabricates facts in responses

---

## Memory Architecture

```mermaid
graph LR
    subgraph ShortTerm["Short-Term (Run Context)"]
        RT[Current task]
        RR[Current research]
        RA[Recent analytics]
        RS[Current strategy]
    end

    subgraph Episodic["Episodic (Historical Events)"]
        EP[Published posts]
        EE[Experiment results]
        EC[Strategy changes]
        EV[Audience events]
    end

    subgraph Semantic["Semantic Strategic Memory"]
        SH[High-performing hooks]
        SW[Winning content themes]
        SP[Audience pain points]
        ST[Best time windows]
        SF[Failed tactics]
        SC[Policy constraints]
    end

    ORCH[Orchestrator] -->|loads at run start| ShortTerm
    ShortTerm -->|queries selectively| Episodic
    ShortTerm -->|queries selectively| Semantic
    Episodic -->|updates| Semantic
```

---

## Queue Architecture

| Queue | Purpose | Workers |
|-------|---------|---------|
| `research` | Web search + synthesis | Research Worker |
| `strategy` | Strategy evaluation + revision | Strategy Worker |
| `content-generation` | Idea + copy + caption generation | Content Worker |
| `media-generation` | Image/video asset generation | Media Worker |
| `quality-check` | Policy + safety evaluation | QC Worker |
| `publishing` | Instagram publish + status poll | Publishing Worker |
| `analytics` | Metrics ingestion + calculation | Analytics Worker |
| `engagement` | Comment fetch + classify + reply | Engagement Worker |
| `learning` | Insight + strategy update | Learning Worker |
| `notifications` | In-app notifications | Notifications Worker |

---

## Data Flow: Content From Idea to Published

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant CA as Content Agent
    participant PE as Policy Engine
    participant S as Scheduler
    participant PW as Publishing Worker
    participant IG as Instagram Adapter
    participant AW as Analytics Worker

    O->>CA: generate_content_plan(strategyVersion, accountProfile)
    CA->>CA: generate ideas + score each
    CA->>PE: validate_content(idea)
    PE-->>CA: PolicyDecision { ALLOW | REVIEW | BLOCK }
    CA->>S: schedule_post(idea, bestTimeWindow)
    S->>PW: enqueue publishing job (scheduled_at)

    Note over PW: At scheduled time...
    PW->>PE: final_policy_check(post)
    PE-->>PW: ALLOW
    PW->>IG: create_media_container(mediaUrl, caption)
    IG-->>PW: upload_id
    PW->>IG: poll_status(upload_id) until FINISHED
    PW->>IG: publish_container(upload_id)
    IG-->>PW: platform_post_id
    PW->>PW: update post status=PUBLISHED
    PW->>AW: schedule analytics collection (+24h, +72h)

    Note over AW: After observation window...
    AW->>IG: get_post_insights(platform_post_id)
    IG-->>AW: raw metrics
    AW->>AW: normalize + compute derived KPIs
    AW->>AW: compare vs account baseline
```

---

## Security Architecture

- All social OAuth tokens encrypted at rest with AES-256-GCM
- JWT for admin auth (httpOnly cookies)
- Rate limiting on all API endpoints
- Webhook signature validation
- No secrets in logs or responses
- All LLM tool calls schema-validated before execution
- Policy engine gate before every external action

---

## Scaling Considerations (V1)

V1 is a modular monolith suitable for a single server/VPS. The clear module boundaries mean that if the system needs to scale later, each module can become a separate service. BullMQ queues are already designed for distributed worker scaling (add more workers pointing at the same Redis instance).
