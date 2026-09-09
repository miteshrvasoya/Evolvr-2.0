import { z } from 'zod';
import { StructuredLLMRequest } from '../modules/llm/llm.types.js';

export interface CommentContext {
  postCaption: string;
  commentAuthor: string;
  commentText: string;
  brandVoice: string;
  bannedTopics: string[];
}

const commentReplySchema = z.object({
  intent: z.enum(['question', 'praise', 'complaint', 'spam', 'general']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  suggestedReply: z.string().optional(),
  rationale: z.string(),
});

export type CommentReplyOutput = z.infer<typeof commentReplySchema>;

export function generateCommentReplyPrompt(ctx: CommentContext): StructuredLLMRequest<CommentReplyOutput> {
  return {
    systemPrompt: `You are a community management agent handling replies for a brand.

Brand Voice: ${ctx.brandVoice}
Banned Topics: ${ctx.bannedTopics.join(', ')}

Rules:
- Identify the user's intent and sentiment.
- If it's a complaint or high risk, mark riskLevel as 'high' and do NOT provide a suggestedReply.
- If it's spam, mark as 'spam' and do NOT provide a suggestedReply.
- If it's safe and positive/neutral, write a brief, authentic reply matching the brand voice.`,
    
    userPrompt: `Context Post Caption:
${ctx.postCaption}

Comment from @${ctx.commentAuthor}:
"${ctx.commentText}"

Analyze the comment and generate a reply if safe.`,
    
    outputSchema: commentReplySchema,
    schemaName: 'generateCommentReply',
  };
}

export interface InsightContext {
  hypothesis: string;
  controlMetrics: string;
  variantMetrics: string;
}

const insightSchema = z.object({
  conclusion: z.enum(['confirmed', 'rejected', 'inconclusive']),
  confidence: z.number().min(0).max(1),
  insightStatement: z.string(),
  nextSteps: z.array(z.string()),
});

export type InsightOutput = z.infer<typeof insightSchema>;

export function generateInsightPrompt(ctx: InsightContext): StructuredLLMRequest<InsightOutput> {
  return {
    systemPrompt: `You are an analytics data scientist. Analyze A/B test results and draw statistical conclusions.
Ensure your conclusions are purely data-driven. Do not confirm a hypothesis without strong metric differences.`,
    userPrompt: `Hypothesis: ${ctx.hypothesis}
Control Metrics: ${ctx.controlMetrics}
Variant Metrics: ${ctx.variantMetrics}

Analyze the result.`,
    outputSchema: insightSchema,
    schemaName: 'generateInsight',
  };
}
