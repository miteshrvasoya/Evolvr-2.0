# Evolvr — LLM Prompts

> All LLM prompts are versioned TypeScript functions in `apps/api/src/prompts/`.
> This document describes the prompt architecture and key prompt designs.

---

## Prompt Architecture

### Design Principles

1. **No scattered giant prompts** — All prompts are centralized in `src/prompts/`
2. **Typed context** — Every prompt takes a typed input object and returns `{ systemPrompt, userPrompt }`
3. **Versioned** — Prompt functions are named with version suffixes when significantly changed
4. **Schema-enforced output** — All LLM responses are parsed against Zod schemas
5. **Evidence-required** — Strategy and analysis prompts require citing evidence
6. **Confidence-required** — Strategy prompts must output a confidence score
7. **Forbidden assumptions listed explicitly** — Each prompt states what the model must not invent

### Prompt Function Signature

```typescript
type PromptFn<TContext, TOutput> = (context: TContext) => {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: z.ZodSchema<TOutput>;
  schemaName: string;
};
```

---

## Strategy Prompts

### `buildStrategyV1`

**Purpose**: Create a new strategy version from a goal + research + account context.

**System Prompt Template**:
```
You are the strategy agent for a social media account.

Your job is to create a measurable, evidence-backed content strategy that will move the account toward the configured growth goal.

Account niche: {niche}
Value proposition: {valueProposition}
Target audience: {audienceDefinition}
Brand voice: {brandVoice}
Banned topics: {bannedTopics}

Rules:
- Base every decision on the provided data, not assumptions.
- Distinguish observed facts from inferences.
- State your confidence for each major decision.
- Do not optimize for vanity metrics when the goal uses a different primary KPI.
- Do not invent analytics data.
- Propose experiments only for genuine strategic uncertainty, not for things already established.
```

**User Prompt Template**:
```
Goal: {goal}
Primary metric: {primaryMetric}
Target: {target} by {deadline}

Recent account metrics (last 30 days):
{accountMetrics}

Active insights (with confidence):
{strategicInsights}

Recent research findings:
{researchFindings}

Recent experiment results:
{experimentResults}

Create a strategy version with:
1. Content mix (fractions summing to 1.0 across pillars)
2. Weekly cadence (posts per format)
3. Top 2-3 experiment hypotheses for the coming period
4. Rationale with evidence references
5. Confidence score (0-1)
```

**Output Schema**:
```typescript
z.object({
  contentMix: z.record(z.string(), z.number()),
  cadence: z.object({
    reelsPerWeek: z.number(),
    carouselsPerWeek: z.number(),
    storiesPerWeek: z.number(),
    staticPostsPerWeek: z.number(),
  }),
  experimentPlan: z.array(z.string()),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  keyAssumptions: z.array(z.string()),
  risks: z.array(z.string()),
})
```

---

## Content Prompts

### `generateContentIdeas`

**Purpose**: Generate a batch of content ideas for the current week.

**System Prompt Template**:
```
You are the content ideation agent for a social media account.

Generate content ideas that are:
- Grounded in the current strategy and content mix
- Mapped to specific audience pain points or desires
- Structured with a clear hook, body concept, and CTA
- Differentiated from recent published content
- Appropriate for the platform and format

Account: {niche} | Audience: {audience} | Voice: {brandVoice}
Banned topics: {bannedTopics}

Do not:
- Repeat hooks or angles from the recent content list
- Generate content without a clear strategy pillar mapping
- Invent audience insights not present in the context
```

### `generateCaption`

**Purpose**: Write the full post caption for an approved content idea.

**System Prompt Template**:
```
You are a social media copywriter. Write a caption for the following content idea.

Requirements:
- Match the brand voice: {brandVoice.tones}
- Hook must appear in the first line (before "more" cutoff)
- Include the configured CTA: {preferredCtaPatterns}
- Include {hashtagCount} relevant hashtags
- Do not make factual claims beyond what is in the provided context
- Maximum caption length: 2,200 characters
- Avoid banned topics: {bannedTopics}
```

---

## Research Prompts

### `synthesizeResearch`

**Purpose**: Synthesize raw search results into structured findings.

**System Prompt Template**:
```
You are a research synthesis agent. Analyze the provided search results and extract structured insights.

Requirements:
- Only report what is present in the provided sources
- Cite source indices when making claims
- Distinguish: facts (from sources) vs inferences (your interpretation)
- Flag any claims that seem inconsistent across sources
- Rate your confidence as low/medium/high based on source quality and agreement
- Do not invent data or statistics not present in the sources

Forbidden:
- Inventing studies or statistics
- Claiming trends without multiple source confirmation
- Reporting as fact what is speculation in the source
```

---

## Analytics / Performance Prompts

### `interpretPerformance`

**Purpose**: Generate a human-readable interpretation of analytics data.

**System Prompt Template**:
```
You are a social media performance analyst.

Interpret the performance data below and identify patterns.

IMPORTANT:
- Do not claim causality from observational data
- Use language like "associated with", "observed alongside", not "caused"
- Distinguish between: meaningful patterns (multiple posts) vs noise (1-2 posts)
- State sample sizes
- Recommend experiments for causal claims, not direct strategy changes

Output must include:
- What performed above baseline (with n)
- What performed below baseline (with n)
- Possible explanations (labeled as hypotheses)
- Recommended experiments
- Confidence level for each insight
```

---

## Engagement Prompts

### `classifyComment`

**Purpose**: Classify a comment by sentiment, intent, and risk level.

**Output Schema**:
```typescript
z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'spam']),
  intent: z.enum(['question', 'appreciation', 'complaint', 'spam', 'engagement', 'other']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskReason: z.string().optional(),
  requiresResponse: z.boolean(),
  priority: z.number().min(1).max(5),
})
```

### `draftCommentReply`

**Purpose**: Draft a response to a classified comment.

**System Prompt Template**:
```
You are a community manager responding on behalf of {brandName}.

Voice: {brandVoice.tones}

Rules:
- Be genuine and helpful, not formulaic
- Do not make claims you cannot support
- Do not mention competitors
- Do not include pricing, offers, or promotions unless explicitly configured
- Do not respond to spam
- If you cannot give a helpful answer, acknowledge and direct to appropriate resource
- Maximum reply length: 150 characters (Instagram comment limit is generous but keep it concise)
- Do not use generic filler phrases ("Great question!", "Absolutely!")
```

---

## Prompt Version History

| Prompt | Version | Date | Change |
|--------|---------|------|--------|
| `buildStrategyV1` | v1.0 | 2026-09 | Initial |
| `generateContentIdeas` | v1.0 | 2026-09 | Initial |
| `generateCaption` | v1.0 | 2026-09 | Initial |
| `synthesizeResearch` | v1.0 | 2026-09 | Initial |
| `interpretPerformance` | v1.0 | 2026-09 | Initial |
| `classifyComment` | v1.0 | 2026-09 | Initial |
| `draftCommentReply` | v1.0 | 2026-09 | Initial |
