import { z } from 'zod';
import { StructuredLLMRequest } from '../modules/llm/llm.types.js';

export interface ContentIdeationContext {
  niche: string;
  audienceDefinition: string;
  brandVoice: string;
  activePillars: string[];
  recentPosts: string; // JSON string of recent topics to avoid duplicates
  bannedTopics: string[];
}

const ideaSchema = z.object({
  ideas: z.array(z.object({
    pillar: z.string(),
    format: z.enum(['reel', 'carousel', 'static_post', 'story']),
    concept: z.string().describe('The core idea (Goal -> Pillar -> Pain -> Angle)'),
    hook: z.string().describe('The first 3 seconds or first sentence'),
    rationale: z.string().describe('Why this works for the audience and strategy'),
  })).length(5)
});

export type ContentIdeationOutput = z.infer<typeof ideaSchema>;

export function generateContentIdeasPrompt(ctx: ContentIdeationContext): StructuredLLMRequest<ContentIdeationOutput> {
  return {
    systemPrompt: `You are the content ideation agent for a social media account.
Your job is to generate 5 highly engaging, strategy-aligned content ideas.

Account Niche: ${ctx.niche}
Audience: ${ctx.audienceDefinition}
Active Strategy Pillars: ${ctx.activePillars.join(', ')}
Brand Voice: ${ctx.brandVoice}
Banned Topics: ${ctx.bannedTopics.join(', ')}

Rules:
- Ideas MUST map to one of the Active Strategy Pillars.
- Hooks must be curiosity-driven or clearly state the value proposition.
- Do NOT repeat recent concepts.
- Provide exactly 5 diverse ideas.`,
    
    userPrompt: `Recent posts (Avoid duplicating these concepts):
${ctx.recentPosts}

Generate 5 new content ideas.`,
    
    outputSchema: ideaSchema,
    schemaName: 'generateContentIdeasOutput',
  };
}

export interface CaptionGenerationContext {
  brandVoice: string;
  concept: string;
  hook: string;
  format: string;
  preferredCtaPatterns: string[];
  bannedTopics: string[];
}

const captionSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()).max(10),
  altText: z.string().optional(),
});

export type CaptionGenerationOutput = z.infer<typeof captionSchema>;

export function generateCaptionPrompt(ctx: CaptionGenerationContext): StructuredLLMRequest<CaptionGenerationOutput> {
  return {
    systemPrompt: `You are a professional social media copywriter. Write a caption for the following concept.

Brand Voice: ${ctx.brandVoice}
Format: ${ctx.format}
Banned Topics: ${ctx.bannedTopics.join(', ')}

Rules:
- The exact provided Hook MUST be the very first line of the caption.
- Use one of the preferred CTA patterns.
- Do not make factual claims without evidence.
- Keep the caption engaging, readable (use line breaks), and authentic.
- Provide appropriate hashtags.`,

    userPrompt: `Concept: ${ctx.concept}
Required Hook: ${ctx.hook}
Preferred CTAs: ${ctx.preferredCtaPatterns.join(' | ')}

Write the full caption.`,
    
    outputSchema: captionSchema,
    schemaName: 'generateCaptionOutput',
  };
}
