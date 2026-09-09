# Evolvr — Autonomy Policy

> This document defines which actions the agent can take autonomously, which require owner approval, and which are blocked entirely.

---

## Core Principle

**The system should optimize toward the owner's business/social growth objective, not merely maximize posting frequency or generate content.**

Every autonomous action must be bounded by explicit risk classification. This is implemented as a `PolicyEngine` module — not scattered if/else statements.

---

## Autonomy Modes

The system supports three modes, configurable per account:

### Manual
The agent prepares strategy, content plans, and schedules — but **does not execute any external actions**. Everything is presented in the dashboard for human review. The owner must click "Publish" manually.

### Supervised (Default V1)
The agent autonomously executes **Low Risk** actions. **Medium Risk** actions require owner approval via in-app notification before execution. **High Risk** actions are blocked.

### Autonomous
The agent executes all **Low Risk** and **Medium Risk** actions according to configured policy. **High Risk** actions remain blocked.

---

## Risk Classification Matrix

### Low Risk — Fully Autonomous in Supervised + Autonomous Modes

| Action | Description |
|--------|-------------|
| Web research | Query search APIs, synthesize findings |
| Generate strategy | Create internal strategy versions |
| Generate content drafts | Ideas, hooks, captions, scripts |
| Analyze analytics | Pull metrics, compute KPIs, compare baselines |
| Propose experiments | Create experiment plans |
| Select content pillars | Choose from pre-approved pillars |
| Select publishing time | Within configured time windows |
| Publish standard content | After all policy checks pass |
| Collect comments | Read comment data from API |
| Classify comments | Sentiment, intent, risk classification |
| Draft engagement responses | Create response drafts for review |
| Auto-reply low-risk comments | Appreciation/simple questions, low risk only |
| Record insights | Store learned patterns |
| Update strategy version | When evidence threshold met |
| Send in-app notifications | Status updates, non-critical alerts |

### Medium Risk — Requires Approval in Supervised Mode

| Action | Description |
|--------|-------------|
| New content pillar | Introducing a topic outside existing pillars |
| Major brand voice change | Significant tone/style shift |
| New campaign concept | Multi-post campaign not in existing plan |
| Sensitive topic content | Content adjacent to sensitive categories |
| Competitor mentions | Any post referencing named competitors |
| Reply to complaint comments | Negative sentiment comments needing response |
| Content with factual claims | Posts making verifiable claims that require verification |
| Content mentioning pricing | Any reference to price/cost/value |
| First post in new format | First reel, first carousel, etc. |
| Experiment launch | Starting a new A/B experiment |

### High Risk — Blocked by Default (All Modes)

| Action | Status |
|--------|--------|
| Delete published content | Blocked — requires manual action |
| Paid promotions / ad spend | Blocked in V1 |
| Legal / medical / financial claims | Blocked |
| Political or controversial content | Blocked |
| Public escalation or hostile replies | Blocked |
| Mass DM or follow/follow-unfollow automation | Blocked permanently |
| Fake engagement, purchased likes/followers | Blocked permanently |
| Browser automation against platform websites | Blocked permanently |
| Content designed to evade platform safeguards | Blocked permanently |

---

## Policy Engine Implementation

The `PolicyEngine` evaluates content through a sequential pipeline before every automated publication:

```
Generated content
      ↓
Brand voice check       ← Does it match configured tone/voice?
      ↓
Factuality check        ← Does it make verifiable claims without evidence?
      ↓
Platform safety check   ← Would this violate Meta community standards?
      ↓
Sensitive topic check   ← Does it touch banned or restricted topics?
      ↓
Duplicate check         ← Is this substantially similar to recent content?
      ↓
Spam/repetition check   ← Too many posts in short window? Repeating exact CTAs?
      ↓
Media validation        ← Correct format, size, duration for platform?
      ↓
Approval policy check   ← Based on risk level and autonomy mode
      ↓
Decision: ALLOW | REVIEW | BLOCK
```

### Policy Decision Output

```json
{
  "decision": "REVIEW",
  "risk": "medium",
  "reasons": ["Contains an unsupported factual claim about competitor pricing"],
  "requiresApproval": true,
  "checkResults": [
    { "check": "brand_voice", "passed": true },
    { "check": "factuality", "passed": false, "reason": "Claim requires verification" },
    { "check": "platform_safety", "passed": true },
    { "check": "sensitive_topics", "passed": true },
    { "check": "duplicate", "passed": true },
    { "check": "spam", "passed": true },
    { "check": "media_validation", "passed": true }
  ]
}
```

---

## Approval Workflow

When an action requires approval:

1. Agent sets content/post status to `WAITING_APPROVAL`
2. In-app notification created (priority: high)
3. Dashboard shows pending approvals prominently
4. Owner reviews the content, reasoning, and policy decision
5. Owner clicks **Approve** or **Reject**
6. On Approve: content proceeds to publishing queue
7. On Reject: content archived, agent records rejection as feedback

Approval requests expire after 48 hours. Expired requests are auto-rejected and the agent generates a replacement.

---

## Safety Guardrails (Non-Negotiable)

These cannot be overridden even in Autonomous mode:

1. **No fabricated metrics** — The agent cannot invent or hallucinate performance data
2. **No platform TOS violations** — Actions that would violate Meta's terms are blocked at the adapter level
3. **No irreversible mass actions** — No bulk deletion, no mass unfollowing
4. **No impersonation** — Content cannot claim to be from a person/brand not configured
5. **No external financial commitments** — No ad spend without human initiation
6. **Secrets never in content** — No API keys, tokens, or internal data in generated posts
7. **LLM tool calls require schema validation** — All LLM-generated tool calls are validated against JSON schemas before execution

---

## Configuring Approval Policy

In the admin dashboard under **Settings → Autonomy Controls**, the owner can:

- Switch between Manual / Supervised / Autonomous modes
- See the full risk matrix for the current mode
- Configure custom rules per content pillar or topic
- Set maximum posts per day (hard ceiling regardless of mode)
- Configure time-of-day publishing windows
