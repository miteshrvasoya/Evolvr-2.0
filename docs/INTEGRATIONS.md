# Evolvr — Integrations Guide

> This document covers the setup required for each external service integration.
> **Always use official documentation.** Links below point to current official sources.

---

## 1. Meta / Instagram (Graph API)

### Development Setup (Dev-Mode App)

For local development, you use a Meta developer app in **development mode**. This allows up to 25 test users without app review.

**Step 1: Create a Meta App**

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Choose **Business** type
4. Complete app creation

**Step 2: Add Instagram Graph API Product**

1. In your app dashboard, click **Add Product**
2. Find **Instagram Graph API** and click **Set Up**

**Step 3: Get App Credentials**

From your app's **Settings → Basic**:
```
META_APP_ID=<Your App ID>
META_APP_SECRET=<Your App Secret>
```

**Step 4: Configure OAuth Redirect URI**

In **Instagram → Settings**:
1. Add `http://localhost:3001/api/oauth/instagram/callback` to **Valid OAuth Redirect URIs**

Set:
```
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/oauth/instagram/callback
```

**Step 5: Required Permissions (Dev Mode)**

For dev mode, you need these permissions (available without app review):
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`
- `instagram_manage_comments`
- `pages_show_list`
- `pages_read_engagement`

**Step 6: Connect a Test Account**

In the dashboard, navigate to **Settings → Platform Connection → Connect Instagram**. This triggers the OAuth flow. Your Instagram Professional Account will be connected.

### Production Setup

For production, you must submit your app for Meta App Review requesting:
- `instagram_content_publish`
- `instagram_manage_insights`
- `instagram_manage_comments`

Update `INSTAGRAM_REDIRECT_URI` to your production domain.

### Token Lifecycle

- **Short-lived tokens**: 1 hour. Automatically exchanged for long-lived tokens.
- **Long-lived tokens**: 60 days. The system automatically refreshes tokens before expiry.
- **Token encryption**: All tokens encrypted with AES-256-GCM using `ENCRYPTION_KEY`.

### API Version

```
INSTAGRAM_API_VERSION=v21.0
```

Check [developers.facebook.com/docs/instagram-api/](https://developers.facebook.com/docs/instagram-api/) for the latest stable version.

### Rate Limits (as of v21.0)

- Content publishing: 50 API calls per hour per user
- Insights: 200 calls per hour per user
- Token refresh: Not rate limited

---

## 2. LLM Providers

### OpenRouter (Default)

OpenRouter aggregates access to all major LLM providers through a single API.

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key
3. Set:

```
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini     # cheap, fast tasks
OPENROUTER_STRONG_MODEL=anthropic/claude-3-5-sonnet  # strategy/reasoning
```

**Cost guidance:**
- Use `gpt-4o-mini` or `gemini-flash-1.5` for classification, extraction, simple generation
- Use `claude-3-5-sonnet` or `gpt-4o` only for strategy reasoning and complex synthesis

### Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Create an API key
3. Set:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_DEFAULT_MODEL=gemini-1.5-flash
GEMINI_STRONG_MODEL=gemini-1.5-pro
```

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Set:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini
OPENAI_STRONG_MODEL=gpt-4o
```

### Anthropic

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Set:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-3-haiku-20240307
ANTHROPIC_STRONG_MODEL=claude-3-5-sonnet-20241022
```

---

## 3. Research Providers

### Serper (Default)

Google Search results via API. ~$0.001 per query.

1. Sign up at [serper.dev](https://serper.dev)
2. Set:

```
RESEARCH_PROVIDER=serper
SERPER_API_KEY=...
```

### Tavily

AI-optimized search with structured results. Better for synthesis tasks.

1. Sign up at [tavily.com](https://tavily.com)
2. Set:

```
RESEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
```

---

## 4. Object Storage

### Local Storage (Default — Development)

Files stored on disk at `STORAGE_LOCAL_DIR`. Served via Fastify static plugin.

```
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./storage
```

The `./storage` directory is created automatically and is git-ignored.

### Cloudflare R2

S3-compatible storage with no egress fees.

1. Create a Cloudflare account and enable R2
2. Create a bucket
3. Create an API token with R2 read/write
4. Set:

```
STORAGE_PROVIDER=r2
STORAGE_BUCKET=evolvr-assets
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY=<R2 access key ID>
STORAGE_SECRET_KEY=<R2 secret access key>
STORAGE_REGION=auto
STORAGE_PUBLIC_URL=https://assets.<your-domain>.com
```

### AWS S3

```
STORAGE_PROVIDER=s3
STORAGE_BUCKET=evolvr-assets
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_ACCESS_KEY=AKIA...
STORAGE_SECRET_KEY=...
STORAGE_REGION=us-east-1
STORAGE_PUBLIC_URL=https://evolvr-assets.s3.amazonaws.com
```

---

## 5. Encryption Key

Generate a secure 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the output as `ENCRYPTION_KEY`. This key encrypts OAuth tokens at rest. **Back it up securely. Losing it means all connected accounts must be reconnected.**

---

## 6. Simulation Mode

When `SIMULATION_MODE=true`, the system uses `SimulatedInstagramAdapter`:

- No real Meta API calls are made
- Posts are stored in the database with a `sim_` prefix
- Analytics are generated with configurable performance profiles
- The full agent loop (research → strategy → content → publish → analytics → learning) works end-to-end

This is the recommended environment for development, testing, and validating agent behavior before connecting a real account.
