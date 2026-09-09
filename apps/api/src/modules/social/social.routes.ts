import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../../db/client.js';

const socialAccountSchema = z.object({
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'tiktok', 'youtube']),
  platformAccountId: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileImageUrl: z.string().url().optional(),
});

const profileSchema = z.object({
  niche: z.string(),
  valueProposition: z.string(),
  audienceDefinition: z.any().default({}),
  brandVoice: z.any().default({}),
  visualGuidelines: z.any().default({}),
  publishingConstraints: z.any().default({}),
  businessGoals: z.any().default({}),
  conversionGoals: z.any().default({}),
  allowedTopics: z.any().default([]),
  bannedTopics: z.any().default([]),
  competitorAccounts: z.any().default([]),
  preferredCtaPatterns: z.any().default([]),
  approvalPolicy: z.any().default({}),
});

export default async function socialRoutes(app: FastifyInstance) {
  // Protect all social routes
  app.addHook('onRequest', app.authenticate);

  // List Social Accounts
  app.get('/accounts', async (request, reply) => {
    const { id: userId } = request.user;
    const accounts = await sql`SELECT * FROM social_accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return { success: true, data: { accounts } };
  });

  // Create Social Account (Mock for Dev, usually done via OAuth)
  app.post('/accounts', async (request, reply) => {
    const { id: userId } = request.user;
    const parseResult = socialAccountSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid data' }, issues: parseResult.error.issues });
    }
    
    const account = parseResult.data;
    const result = await sql`
      INSERT INTO social_accounts (
        user_id, platform, platform_account_id, username, display_name, profile_image_url, connection_status
      ) VALUES (
        ${userId}, ${account.platform}, ${account.platformAccountId}, ${account.username}, ${account.displayName}, ${account.profileImageUrl || null}, 'connected'
      ) RETURNING *
    `;
    return { success: true, data: { account: result[0] } };
  });

  // Get Account Profile
  app.get('/accounts/:accountId/profile', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    // Verify ownership
    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } });

    const profiles = await sql`SELECT * FROM account_profiles WHERE social_account_id = ${accountId}`;
    return { success: true, data: { profile: profiles[0] || null } };
  });

  // Create or Update Account Profile
  app.put('/accounts/:accountId/profile', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    // Verify ownership
    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } });

    const parseResult = profileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid data' }, issues: parseResult.error.issues });
    }

    const p = parseResult.data;

    const result = await sql`
      INSERT INTO account_profiles (
        social_account_id, niche, value_proposition, audience_definition, brand_voice, 
        visual_guidelines, publishing_constraints, business_goals, conversion_goals, 
        allowed_topics, banned_topics, competitor_accounts, preferred_cta_patterns, approval_policy
      ) VALUES (
        ${accountId}, ${p.niche}, ${p.valueProposition}, ${p.audienceDefinition}, ${p.brandVoice},
        ${p.visualGuidelines}, ${p.publishingConstraints}, ${p.businessGoals}, ${p.conversionGoals},
        ${p.allowedTopics}, ${p.bannedTopics}, ${p.competitorAccounts}, ${p.preferredCtaPatterns}, ${p.approvalPolicy}
      )
      ON CONFLICT (social_account_id) DO UPDATE SET
        niche = EXCLUDED.niche,
        value_proposition = EXCLUDED.value_proposition,
        audience_definition = EXCLUDED.audience_definition,
        brand_voice = EXCLUDED.brand_voice,
        visual_guidelines = EXCLUDED.visual_guidelines,
        publishing_constraints = EXCLUDED.publishing_constraints,
        business_goals = EXCLUDED.business_goals,
        conversion_goals = EXCLUDED.conversion_goals,
        allowed_topics = EXCLUDED.allowed_topics,
        banned_topics = EXCLUDED.banned_topics,
        competitor_accounts = EXCLUDED.competitor_accounts,
        preferred_cta_patterns = EXCLUDED.preferred_cta_patterns,
        approval_policy = EXCLUDED.approval_policy,
        updated_at = NOW()
      RETURNING *
    `;

    return { success: true, data: { profile: result[0] } };
  });
}
