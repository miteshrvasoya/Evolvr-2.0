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

  async publishPost(accessToken: string, platformAccountId: string, mediaUrls: string[], caption: string, mediaType: string = 'image') {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('No media URLs provided for publishing');
    }

    const isVideo = mediaType === 'video_placeholder' || mediaType === 'video' || mediaType === 'reel' || mediaType === 'reels';
    const isCarousel = mediaUrls.length > 1;

    let creationId: string;

    if (isCarousel) {
      // 1a. Create Item Containers for each media URL
      const itemCreationIds: string[] = [];
      for (const url of mediaUrls) {
        const itemUrl = `${this.baseApiUrl}/me/media`;
        const itemParams = new URLSearchParams({
          access_token: accessToken,
          is_carousel_item: 'true',
        });
        
        // Guess if item is video based on extension, otherwise default to image
        if (url.includes('.mp4') || url.includes('.mov') || isVideo) {
          itemParams.append('media_type', 'VIDEO');
          itemParams.append('video_url', url);
        } else {
          itemParams.append('image_url', url);
        }

        const { response: itemRes, data: itemData } = await this.fetchWithLog(`${itemUrl}?${itemParams.toString()}`, { method: 'POST' });
        if (!itemRes.ok) throw new Error(itemData.error?.message || 'Failed to create carousel item container');
        itemCreationIds.push(itemData.id);
      }

      // Wait for all item containers to finish processing (videos can take time)
      for (const itemId of itemCreationIds) {
        await this.waitForContainer(itemId, accessToken);
      }

      // 1b. Create Carousel Container
      const carouselUrl = `${this.baseApiUrl}/me/media`;
      const carouselParams = new URLSearchParams({
        caption: caption,
        access_token: accessToken,
        media_type: 'CAROUSEL',
        children: itemCreationIds.join(','),
      });

      const { response: carRes, data: carData } = await this.fetchWithLog(`${carouselUrl}?${carouselParams.toString()}`, { method: 'POST' });
      if (!carRes.ok) throw new Error(carData.error?.message || 'Failed to create carousel container');
      
      creationId = carData.id;

    } else {
      // Single Media
      const createUrl = `${this.baseApiUrl}/me/media`;
      const createParams = new URLSearchParams({
        caption: caption,
        access_token: accessToken,
      });

      if (isVideo) {
        createParams.append('media_type', 'REELS');
        createParams.append('video_url', mediaUrls[0]!);
      } else {
        createParams.append('image_url', mediaUrls[0]!);
      }

      const { response: createRes, data: createData } = await this.fetchWithLog(`${createUrl}?${createParams.toString()}`, { method: 'POST' });
      if (!createRes.ok) throw new Error(createData.error?.message || 'Failed to create media container');
      
      creationId = createData.id;
    }

    // 2. Poll Status to wait until FINISHED
    await this.waitForContainer(creationId, accessToken);

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

  private async waitForContainer(creationId: string, accessToken: string) {
    let isReady = false;
    let attempts = 0;
    while (!isReady && attempts < 15) { // Try for ~45 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
      
      const statusUrl = `${this.baseGraphUrl}/${creationId}?fields=status_code&access_token=${accessToken}`;
      const { response: statusRes, data: statusData } = await this.fetchWithLog(statusUrl);
      
      if (statusRes.ok && statusData.status_code) {
        const status = statusData.status_code;
        if (status === 'FINISHED') {
          isReady = true;
        } else if (status === 'ERROR' || status === 'EXPIRED') {
          throw new Error(`Media container processing failed with status: ${status}`);
        }
      }
    }

    if (!isReady) {
      throw new Error('Media container timed out waiting for FINISHED status');
    }
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
    // ── v25.0: fetch all interaction metrics with metric_type=total_value ──────
    // Use a 7-day window so we get meaningful aggregated data not just 1 day
    const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);

    const INTERACTION_METRICS = [
      'reach',
      'accounts_engaged',
      'views',
      'likes',
      'comments',
      'shares',
      'saves',
      'replies',
      'reposts',
      'total_interactions',
      'profile_links_taps',
    ].join(',');

    const insightsUrl =
      `${this.baseGraphUrl}/${platformAccountId}/insights` +
      `?metric=${INTERACTION_METRICS}` +
      `&period=day` +
      `&metric_type=total_value` +
      `&since=${since}` +
      `&until=${until}` +
      `&access_token=${accessToken}`;

    const { response: insRes, data: insData } = await this.fetchWithLog(insightsUrl);

    const metrics: Record<string, number> = {};
    if (insRes.ok) {
      for (const item of insData.data || []) {
        // total_value response: { name, total_value: { value } }
        metrics[item.name] = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
      }
    } else {
      LoggerService.logError({
        errorMessage: insData?.error?.message || 'Failed to fetch account insights',
        context: { platformAccountId, errorData: insData },
      });
    }

    // ── Separate request for follows_and_unfollows (needs breakdown=follow_type) ─
    let follows = 0;
    let unfollows = 0;
    try {
      const followsUrl =
        `${this.baseGraphUrl}/${platformAccountId}/insights` +
        `?metric=follows_and_unfollows` +
        `&period=day` +
        `&metric_type=total_value` +
        `&breakdown=follow_type` +
        `&since=${since}` +
        `&until=${until}` +
        `&access_token=${accessToken}`;

      const { response: fuRes, data: fuData } = await this.fetchWithLog(followsUrl);
      if (fuRes.ok) {
        const item = fuData.data?.[0];
        const results = item?.total_value?.breakdowns?.[0]?.results ?? [];
        for (const r of results) {
          const type = (r.dimension_values?.[0] ?? '').toUpperCase();
          if (type === 'FOLLOWER' || type === 'FOLLOWS') follows += r.value ?? 0;
          if (type === 'UNFOLLOWS') unfollows += r.value ?? 0;
        }
      }
    } catch (_) {
      // Non-critical — leave at 0
    }

    return {
      // Legacy fields kept for backward compat
      impressions: metrics.views ?? 0,
      reach: metrics.reach ?? 0,
      profile_views: metrics.profile_links_taps ?? 0,
      // New comprehensive fields
      views: metrics.views ?? 0,
      accounts_engaged: metrics.accounts_engaged ?? 0,
      likes: metrics.likes ?? 0,
      comments: metrics.comments ?? 0,
      shares: metrics.shares ?? 0,
      saves: metrics.saves ?? 0,
      replies: metrics.replies ?? 0,
      reposts: metrics.reposts ?? 0,
      total_interactions: metrics.total_interactions ?? 0,
      profile_links_taps: metrics.profile_links_taps ?? 0,
      follows,
      unfollows,
    };
  }

  async getAccountMedia(accessToken: string, platformAccountId: string, afterCursor?: string) {
    const fields = 'id,caption,media_type,media_url,permalink,timestamp,username,thumbnail_url,children{media_url,media_type}';
    let url = `${this.baseGraphUrl}/${platformAccountId}/media?fields=${fields}&limit=50&access_token=${accessToken}`;
    
    if (afterCursor) {
      url += `&after=${afterCursor}`;
    }

    const { response, data } = await this.fetchWithLog(url);
    if (!response.ok) {
      if (data.error?.type === 'OAuthException') {
        throw new Error(`AUTH_REQUIRED: ${data.error.message}`);
      }
      throw new Error(data.error?.message || 'Failed to fetch account media');
    }

    return {
      data: data.data || [],
      paging: data.paging || null,
    };
  }
}
