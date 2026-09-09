# Evolvr — Data Model

> This document describes the database schema and entity relationships.

---

## Overview

All data is stored in PostgreSQL 16. The schema uses:
- `UUID` primary keys (generated with `uuid_generate_v4()`)
- `TIMESTAMPTZ` for all timestamps (UTC-aware)
- `JSONB` for flexible structured data
- `CHECK` constraints for enum-like fields
- `updated_at` triggers for automatic timestamp management
- Indexed foreign keys and common query patterns

---

## Entity Relationship Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK
        text name
        text password_hash
        text role
        bool is_active
        timestamptz created_at
        timestamptz updated_at
    }

    social_accounts {
        uuid id PK
        uuid user_id FK
        text platform
        text platform_account_id
        text username
        text display_name
        text profile_image_url
        text access_token_encrypted
        timestamptz token_expires_at
        text connection_status
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    account_profiles {
        uuid id PK
        uuid social_account_id FK UK
        text niche
        text value_proposition
        jsonb audience_definition
        jsonb brand_voice
        jsonb visual_guidelines
        jsonb publishing_constraints
        jsonb business_goals
        jsonb conversion_goals
        jsonb allowed_topics
        jsonb banned_topics
        jsonb competitor_accounts
        jsonb preferred_cta_patterns
        jsonb approval_policy
        timestamptz created_at
        timestamptz updated_at
    }

    admin_goals {
        uuid id PK
        uuid social_account_id FK
        text goal_type
        text primary_metric
        jsonb secondary_metrics
        numeric target
        date deadline
        text audience
        text business_outcome
        text autonomy_level
        jsonb constraints
        bool is_active
        timestamptz created_at
        timestamptz updated_at
    }

    strategy_versions {
        uuid id PK
        uuid social_account_id FK
        int version_number
        jsonb objective
        jsonb content_mix
        jsonb cadence
        jsonb experiment_plan
        text rationale
        jsonb evidence_ids
        numeric confidence
        text status
        timestamptz created_at
    }

    strategic_insights {
        uuid id PK
        uuid social_account_id FK
        text category
        text statement
        jsonb evidence
        numeric confidence
        text scope
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    hypotheses {
        uuid id PK
        uuid strategy_version_id FK
        text statement
        text metric
        text expected_direction
        text expected_effect
        text status
        timestamptz created_at
    }

    research_runs {
        uuid id PK
        uuid social_account_id FK
        jsonb query
        jsonb synthesized_findings
        timestamptz created_at
    }

    research_sources {
        uuid id PK
        uuid research_run_id FK
        text source_url
        text title
        text domain
        timestamptz fetched_at
        text excerpt_or_summary
        text credibility_notes
    }

    content_ideas {
        uuid id PK
        uuid social_account_id FK
        uuid strategy_version_id FK
        text pillar
        text format
        text concept
        text hook
        text caption
        jsonb hashtags
        text script
        text alt_text
        jsonb rationale
        jsonb score
        text status
        jsonb policy_decision
        timestamptz created_at
        timestamptz updated_at
    }

    content_assets {
        uuid id PK
        uuid content_idea_id FK
        text asset_type
        text storage_url
        text mime_type
        int width
        int height
        int duration_ms
        text prompt
        jsonb generation_metadata
        timestamptz created_at
    }

    posts {
        uuid id PK
        uuid social_account_id FK
        uuid content_idea_id FK
        text platform_post_id
        text caption
        text media_type
        timestamptz scheduled_at
        timestamptz published_at
        text status
        uuid strategy_version_id FK
        uuid experiment_id FK
        text failure_reason
        text idempotency_key UK
        timestamptz created_at
        timestamptz updated_at
    }

    post_metrics {
        uuid id PK
        uuid post_id FK
        timestamptz captured_at
        int impressions
        int reach
        int views
        int likes
        int comments
        int shares
        int saves
        int profile_visits
        int follows
        int clicks
        int watch_time_ms
        jsonb retention_data
        numeric engagement_rate
        numeric share_rate
        numeric save_rate
        numeric comment_rate
        numeric profile_visit_rate
        numeric follow_conversion_rate
        jsonb raw_metrics
    }

    account_metrics {
        uuid id PK
        uuid social_account_id FK
        timestamptz captured_at
        int followers
        int following
        int reach
        int impressions
        int profile_visits
        int interactions
        int website_clicks
        jsonb raw_metrics
    }

    experiments {
        uuid id PK
        uuid social_account_id FK
        uuid hypothesis_id FK
        text name
        text variable
        text control_definition
        text treatment_definition
        text primary_metric
        jsonb secondary_metrics
        timestamptz start_at
        timestamptz end_at
        text status
        text conclusion
        numeric confidence
        timestamptz created_at
    }

    experiment_assignments {
        uuid id PK
        uuid experiment_id FK
        uuid content_idea_id FK
        text variant
        timestamptz created_at
    }

    agent_runs {
        uuid id PK
        text run_type
        uuid social_account_id FK
        text status
        timestamptz started_at
        timestamptz completed_at
        jsonb input_snapshot
        jsonb output
        jsonb error
        text correlation_id
    }

    agent_decisions {
        uuid id PK
        uuid agent_run_id FK
        text decision_type
        jsonb decision
        jsonb evidence
        numeric confidence
        text reasoning
        timestamptz created_at
    }

    scheduled_jobs {
        uuid id PK
        text job_type
        jsonb payload
        timestamptz scheduled_for
        text status
        int attempts
        text idempotency_key UK
        timestamptz created_at
    }

    comments {
        uuid id PK
        uuid social_account_id FK
        uuid post_id FK
        text platform_comment_id UK
        text author_handle
        text text
        text sentiment
        text intent
        text risk_level
        text status
        timestamptz created_at
    }

    engagement_actions {
        uuid id PK
        uuid comment_id FK
        text action_type
        text draft_text
        text executed_text
        text status
        jsonb policy_decision
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        text type
        text priority
        text title
        text message
        text action_url
        jsonb metadata
        text status
        timestamptz created_at
        timestamptz read_at
    }

    llm_usage_records {
        uuid id PK
        text provider
        text model
        int input_tokens
        int output_tokens
        numeric cost
        int latency_ms
        text task_type
        uuid agent_run_id FK
        timestamptz created_at
    }

    users ||--o{ social_accounts : "owns"
    users ||--o{ notifications : "receives"
    social_accounts ||--|| account_profiles : "has profile"
    social_accounts ||--o{ admin_goals : "has goals"
    social_accounts ||--o{ strategy_versions : "has strategies"
    social_accounts ||--o{ strategic_insights : "accumulates"
    social_accounts ||--o{ research_runs : "triggers"
    social_accounts ||--o{ content_ideas : "generates"
    social_accounts ||--o{ posts : "publishes"
    social_accounts ||--o{ account_metrics : "tracks"
    social_accounts ||--o{ experiments : "runs"
    social_accounts ||--o{ agent_runs : "drives"
    social_accounts ||--o{ comments : "receives"
    strategy_versions ||--o{ hypotheses : "creates"
    strategy_versions ||--o{ content_ideas : "shapes"
    strategy_versions ||--o{ posts : "associated"
    hypotheses ||--o| experiments : "tested by"
    research_runs ||--o{ research_sources : "cites"
    content_ideas ||--o{ content_assets : "has"
    content_ideas ||--|| posts : "becomes"
    content_ideas ||--o{ experiment_assignments : "assigned"
    experiments ||--o{ experiment_assignments : "has"
    posts ||--o{ post_metrics : "measured by"
    posts ||--o{ comments : "receives"
    agent_runs ||--o{ agent_decisions : "records"
    comments ||--o{ engagement_actions : "triggers"
```

---

## Key Design Decisions

### No ORM
Raw SQL via `postgres` npm package with camelCase transformation. This avoids N+1 problems and keeps queries readable and explicit.

### JSONB for Flexible Structures
Strategy, insights, and analytics raw payloads use JSONB. This allows schema evolution without migrations for non-critical fields while keeping indexed columns for query performance.

### Idempotency Keys
- `posts.idempotency_key`: `publish:{socialAccountId}:{contentId}:{scheduledSlot}`
- `scheduled_jobs.idempotency_key`: `{jobType}:{socialAccountId}:{timeBucket}`
- `post_metrics`: `UNIQUE(post_id, captured_at)` prevents duplicate captures

### Token Security
`social_accounts.access_token_encrypted` stores AES-256-GCM encrypted tokens. The encryption key is never stored in the database — it comes from `ENCRYPTION_KEY` environment variable.

### Historical Preservation
- Strategy versions are never deleted — superseded versions kept with `status='superseded'`
- Strategic insights are never deleted — invalidated insights kept with `status='invalidated'`
- Agent decisions are append-only
- Post metrics are append-only (multiple captures per post for point-in-time tracking)
