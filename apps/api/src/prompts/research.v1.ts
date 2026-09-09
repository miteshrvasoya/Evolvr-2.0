import { z } from 'zod';
import { StructuredLLMRequest } from '../modules/llm/llm.types.js';

export interface ResearchSynthesisContext {
  query: string;
  category: string;
  sources: Array<{ title: string; snippet: string; url: string }>;
  goal: string;
}

const synthesisSchema = z.object({
  summary: z.string(),
  keyInsights: z.array(z.string()),
  actionableRecommendations: z.array(z.string()),
  confidenceLevel: z.enum(['low', 'medium', 'high']),
  limitationsAndCaveats: z.array(z.string()),
});

export type ResearchSynthesisOutput = z.infer<typeof synthesisSchema>;

export function synthesizeResearchPrompt(ctx: ResearchSynthesisContext): StructuredLLMRequest<ResearchSynthesisOutput> {
  return {
    systemPrompt: `You are a research synthesis agent. Analyze the provided search results and extract structured insights relevant to the user's goal.

Goal: ${ctx.goal}

Requirements:
- Only report what is present in the provided sources
- Cite source indices when making claims
- Distinguish: facts (from sources) vs inferences (your interpretation)
- Rate your confidence as low/medium/high based on source quality and agreement
- Do not invent data or statistics not present in the sources`,
    
    userPrompt: `Category: ${ctx.category}
Search Query: ${ctx.query}

Sources:
${ctx.sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}\n`).join('\n')}

Synthesize the findings.`,
    
    outputSchema: synthesisSchema,
    schemaName: 'synthesizeResearchOutput',
  };
}
