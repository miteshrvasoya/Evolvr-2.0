import { env } from '../../../config/env.js';
import { LoggerService } from '../../common/logger.service.js';

export class InstagramAdapter {
  private readonly baseGraphUrl = `https://graph.instagram.com`;
  private readonly baseApiUrl = `${this.baseGraphUrl}/${env.INSTAGRAM_API_VERSION}`;

  private async fetchWithLog(url: string, options: RequestInit = {}): Promise<{ response: Response, data: any }> {
    const start = Date.now();
    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      LoggerService.logApiCall({
        direction: 'outward',
        method: options.method || 'GET',
        url,
        statusCode: response.status,
        requestPayload: options.body ? Object.fromEntries(new URLSearchParams(options.body as string)) : undefined,
        responsePayload: data,
        latencyMs: Date.now() - start
      });

      return { response, data };
    } catch (error: any) {
      LoggerService.logApiCall({
        direction: 'outward',
        method: options.method || 'GET',
        url,
        statusCode: error.status || 500,
        requestPayload: options.body ? Object.fromEntries(new URLSearchParams(options.body as string)) : undefined,
        responsePayload: { error: error.message },
        latencyMs: Date.now() - start
      });
      LoggerService.logError({
        errorMessage: error.message || 'Instagram API Error',
        stackTrace: error.stack,
        context: {
          action: 'InstagramAdapter.fetchWithLog',
          url,
          method: options.method || 'GET'
        }
      });
      throw error;
    }
  }

  async getAuthUrl(redirectUri: string): Promise<string> {
    const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_comments';
    const appId = env.INSTAGRAM_APP_ID || env.META_APP_ID;
    return `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string) {
    const url = `https://api.instagram.com/oauth/access_token`;
    const appId = env.INSTAGRAM_APP_ID || env.META_APP_ID;
    const appSecret = env.INSTAGRAM_APP_SECRET || env.META_APP_SECRET;

    const formData = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    const { response, data } = await this.fetchWithLog(url, { method: 'POST', body: formData });

    if (!response.ok) throw new Error(data.error_message || data.error?.message || 'Failed to exchange token');

    const shortToken = data.access_token;
    const platformAccountId = data.user_id?.toString();

    // Exchange for long-lived token
    const llUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`;
    const { response: llResponse, data: llData } = await this.fetchWithLog(llUrl);

    if (!llResponse.ok) throw new Error(llData.error?.message || 'Failed to get long-lived token');

    return {
      accessToken: llData.access_token,
      platformAccountId,
      expiresIn: llData.expires_in,
    };
  }

  async getAccountProfile(accessToken: string, platformAccountId: string) {
    const url = `${this.baseApiUrl}/me?fields=username,name,profile_picture_url,followers_count,follows_count,media_count,account_type&access_token=${accessToken}`;
    const { response, data } = await this.fetchWithLog(url);
    if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch profile');

    return {
      username: data.username,
      displayName: data.name,
      profileImageUrl: data.profile_picture_url,
      followers: data.followers_count,
      following: data.follows_count,
      mediaCount: data.media_count,
    };
  }

  async publishPost(accessToken: string, platformAccountId: string, mediaUrl: string, caption: string) {
    // 1. Create Media Container
    const createUrl = `${this.baseApiUrl}/me/media`;
    const createParams = new URLSearchParams({
      image_url: mediaUrl,
      caption: caption,
      access_token: accessToken,
    });

    const { response: createRes, data: createData } = await this.fetchWithLog(`${createUrl}?${createParams.toString()}`, { method: 'POST' });
    if (!createRes.ok) throw new Error(createData.error?.message || 'Failed to create media container');

    const creationId = createData.id;

    // 2. Poll Status (Simplified here. In prod, wait until status_code=FINISHED)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Publish
    const publishUrl = `${this.baseApiUrl}/me/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const { response: publishRes, data: publishData } = await this.fetchWithLog(`${publishUrl}?${publishParams.toString()}`, { method: 'POST' });
    if (!publishRes.ok) throw new Error(publishData.error?.message || 'Failed to publish media');

    return {
      platformPostId: publishData.id,
      status: 'published',
    };
  }

  async getPostInsights(accessToken: string, platformPostId: string) {
    const url = `${this.baseApiUrl}/${platformPostId}/insights?metric=impressions,reach,saved,video_views&access_token=${accessToken}`;
    const { response, data } = await this.fetchWithLog(url);
    if (!response.ok) return null;

    const metrics: Record<string, number> = {};
    for (const item of data.data || []) {
      metrics[item.name] = item.values[0]?.value || 0;
    }

    return {
      impressions: metrics.impressions || 0,
      reach: metrics.reach || 0,
      saves: metrics.saved || 0,
      views: metrics.video_views || 0,
      // Likes and comments come from the media node, not insights
    };
  }

  async getAccountInsights(accessToken: string, platformAccountId: string) {
    // The Instagram Graph API uses 'views' instead of 'impressions' for basic display API and some creator accounts
    const url = `${this.baseGraphUrl}/${platformAccountId}/insights?metric=views,reach,profile_views&period=day&access_token=${accessToken}`;
    const { response, data } = await this.fetchWithLog(url);
    if (!response.ok) {
      LoggerService.logError({
        errorMessage: data?.error?.message || 'Failed to fetch account insights',
        context: { platformAccountId, errorData: data }
      });
      return { impressions: 0, reach: 0, profile_views: 0 };
    }

    const metrics: Record<string, number> = {};
    for (const item of data.data || []) {
      metrics[item.name] = item.values[0]?.value || 0;
    }

    return {
      impressions: metrics.views || metrics.impressions || 0,
      reach: metrics.reach || 0,
      profile_views: metrics.profile_views || 0,
    };
  }
}
