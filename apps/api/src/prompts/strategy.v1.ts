import { z } from 'zod';
import { StructuredLLMRequest } from '../modules/llm/llm.types.js';

export interface BuildStrategyContext {
  niche: string;
  valueProposition: string;
  audienceDefinition: string;
  brandVoice: string;
  bannedTopics: string[];
  goal: string;
  primaryMetric: string;
  target: string;
  deadline: string;
  accountMetrics: string;
  strategicInsights: string;
  researchFindings: string;
  experimentResults: string;
}

const strategySchema = z.object({
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
});

export type StrategyOutput = z.infer<typeof strategySchema>;

export function buildStrategyPrompt(ctx: BuildStrategyContext): StructuredLLMRequest<StrategyOutput> {
  return {
    systemPrompt: `You are the strategy agent for a social media account.
Your job is to create a measurable, evidence-backed content strategy that will move the account toward the configured growth goal.

Account niche: ${ctx.niche}
Value proposition: ${ctx.valueProposition}
Target audience: ${ctx.audienceDefinition}
Brand voice: ${ctx.brandVoice}
Banned topics: ${ctx.bannedTopics.join(', ')}

Rules:
- Base every decision on the provided data, not assumptions.
- Distinguish observed facts from inferences.
- State your confidence for each major decision.
- Do not optimize for vanity metrics when the goal uses a different primary KPI.
- Do not invent analytics data.
- Propose experiments only for genuine strategic uncertainty, not for things already established.`,
    
    userPrompt: `Goal: ${ctx.goal}
Primary metric: ${ctx.primaryMetric}
Target: ${ctx.target} by ${ctx.deadline}

Recent account metrics (last 30 days):
${ctx.accountMetrics}

Active insights (with confidence):
${ctx.strategicInsights}

Recent research findings:
${ctx.researchFindings}

Recent experiment results:
${ctx.experimentResults}

Create a strategy version following the output schema. Ensure contentMix fractions sum to 1.0.`,
    
    outputSchema: strategySchema,
    schemaName: 'buildStrategyOutput',
    schemaDescription: 'Structured content strategy with rationale and evidence.',
  };
}
