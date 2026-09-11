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
  imagePrompt: z.string().describe('Highly detailed image generation prompt for the cover image or static post.').optional(),
  videoScript: z.string().describe('Detailed shot-by-shot script if format is reel or story.').optional(),
});

export type CaptionGenerationOutput = z.infer<typeof captionSchema>;

export function generateCaptionPrompt(ctx: CaptionGenerationContext): StructuredLLMRequest<CaptionGenerationOutput> {
  return {
    systemPrompt: `You are a professional social media copywriter and creative director. Write a caption and provide creative direction for the media.

Brand Voice: ${ctx.brandVoice}
Format: ${ctx.format}
Banned Topics: ${ctx.bannedTopics.join(', ')}

Rules for Caption:
- The exact provided Hook MUST be the very first line of the caption.
- Use one of the preferred CTA patterns.
- Do not make factual claims without evidence.
- Keep the caption engaging, readable (use line breaks), and authentic.
- Provide appropriate hashtags.

Rules for Media Direction:
- If format is static_post or carousel, provide a highly detailed 'imagePrompt' describing the exact visual composition, lighting, style, and subject.
- If format is reel or story, provide a detailed 'videoScript' with a shot-by-shot breakdown (timecodes, visuals, audio/text overlays), AND provide an 'imagePrompt' for a high-quality cover image.`,

    userPrompt: `Concept: ${ctx.concept}
Required Hook: ${ctx.hook}
Preferred CTAs: ${ctx.preferredCtaPatterns.join(' | ')}

Write the full caption.`,
    
    outputSchema: captionSchema,
    schemaName: 'generateCaptionOutput',
  };
}
