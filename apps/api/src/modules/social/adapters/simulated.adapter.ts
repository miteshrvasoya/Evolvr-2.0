import { randomUUID } from 'crypto';

export class SimulatedInstagramAdapter {
  async getAuthUrl(redirectUri: string): Promise<string> {
    // Simulated OAuth URL
    return `http://localhost:3000/dashboard/settings?simulated_oauth=true&redirect=${encodeURIComponent(redirectUri)}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string) {
    return {
      accessToken: `sim_token_${randomUUID()}`,
      platformAccountId: `sim_ig_${Math.floor(Math.random() * 10000000)}`,
      expiresIn: 60 * 60 * 24 * 60, // 60 days
    };
  }

  async getAccountProfile(accessToken: string, platformAccountId: string) {
    return {
      username: 'simulated_user_' + platformAccountId.slice(-4),
      displayName: 'Simulated User',
      profileImageUrl: 'https://ui-avatars.com/api/?name=Simulated+User',
      followers: Math.floor(Math.random() * 50000) + 1000,
    };
  }

  async publishPost(accessToken: string, platformAccountId: string, mediaUrl: string, caption: string) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      platformPostId: `sim_post_${randomUUID()}`,
      status: 'published',
    };
  }

  async getPostInsights(accessToken: string, platformPostId: string) {
    // Generate realistic fake metrics
    const reach = Math.floor(Math.random() * 10000) + 500;
    return {
      impressions: Math.floor(reach * (1 + Math.random() * 0.5)),
      reach,
      likes: Math.floor(reach * (0.05 + Math.random() * 0.1)),
      comments: Math.floor(reach * (0.005 + Math.random() * 0.02)),
      shares: Math.floor(reach * (0.01 + Math.random() * 0.05)),
      saves: Math.floor(reach * (0.02 + Math.random() * 0.08)),
      profile_visits: Math.floor(reach * (0.01 + Math.random() * 0.03)),
    };
  }

  async getAccountInsights(accessToken: string, platformAccountId: string) {
    return {
      reach: Math.floor(Math.random() * 100000) + 10000,
      impressions: Math.floor(Math.random() * 150000) + 15000,
      profile_visits: Math.floor(Math.random() * 5000) + 500,
    };
  }
}
