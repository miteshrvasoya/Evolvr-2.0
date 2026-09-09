import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../../db/client.js';
import { env } from '../../config/env.js';
import { getInstagramAdapter } from './adapters/index.js';
import { encryptToken } from '../common/encryption.js';

export default async function oauthRoutes(app: FastifyInstance) {
  // 1. Get Auth URL
  app.get('/oauth/instagram/url', { onRequest: [app.authenticate] }, async (request, reply) => {
    const igAdapter = getInstagramAdapter();
    const redirectUri = env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3001/api/oauth/instagram/callback';
    const url = await igAdapter.getAuthUrl(redirectUri);
    return { success: true, data: { url } };
  });

  // 2. OAuth Callback
  app.get('/oauth/instagram/callback', async (request: any, reply) => {
    // In a real app, you'd pass a state token and verify the logged-in user here.
    // For simplicity, we'll assume we pass userId in state or they are already logged in (cookies).
    // Let's use the standard verify for cookies:
    try {
      await request.jwtVerify({ onlyCookie: true });
    } catch (e) {
      return reply.redirect('http://localhost:3000/login?error=unauthorized');
    }

    const { id: userId } = request.user;
    const { code } = request.query;

    if (!code) {
      return reply.redirect('http://localhost:3000/dashboard/settings?error=missing_code');
    }

    const igAdapter = getInstagramAdapter();
    const redirectUri = env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3001/api/oauth/instagram/callback';

    try {
      // Exchange code for token
      const { accessToken, platformAccountId, expiresIn } = await igAdapter.exchangeCodeForToken(code, redirectUri);

      // Fetch profile info
      const profile = await igAdapter.getAccountProfile(accessToken, platformAccountId);

      // Encrypt token
      const encryptedToken = encryptToken(accessToken);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Save to database
      await sql`
        INSERT INTO social_accounts (
          user_id, platform, platform_account_id, username, display_name, 
          profile_image_url, access_token_encrypted, token_expires_at, connection_status
        ) VALUES (
          ${userId}, 'instagram', ${platformAccountId}, ${profile.username}, 
          ${profile.displayName}, ${profile.profileImageUrl}, ${encryptedToken}, 
          ${expiresAt}, 'connected'
        )
        ON CONFLICT (platform, platform_account_id) DO UPDATE SET
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          token_expires_at = EXCLUDED.token_expires_at,
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          profile_image_url = EXCLUDED.profile_image_url,
          connection_status = 'connected',
          updated_at = NOW()
      `;

      return reply.redirect('http://localhost:3000/dashboard/settings?success=instagram_connected');
    } catch (error: any) {
      app.log.error(error, 'Instagram OAuth Error');
      return reply.redirect(`http://localhost:3000/dashboard/settings?error=${encodeURIComponent(error.message)}`);
    }
  });
}
