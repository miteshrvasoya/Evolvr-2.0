# Evolvr — Testing Guide

## Philosophy

Testing must cover behavior, not just implementation. The agent system's correctness is evaluated by whether it makes **correct decisions**, not just whether functions return without throwing.

---

## Test Framework

- **Unit + Integration**: Vitest
- **E2E**: Playwright (dashboard flows)
- **Agent evaluation**: Custom evaluation harness (`src/evaluation/`)

---

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only (fast)
pnpm test:unit

# Integration tests (requires Postgres + Redis)
pnpm test:integration

# Watch mode
pnpm --filter @evolvr/api test:watch

# Coverage
pnpm --filter @evolvr/api vitest run --coverage
```

---

## Unit Tests

### What to Unit Test

| Module | What to Test |
|--------|-------------|
| KPI calculations | Every derived metric formula |
| Scheduling logic | Time window selection, explore/exploit split |
| Content scoring | Weight calculations, aggregate score |
| Policy evaluation | All 7 check types, ALLOW/REVIEW/BLOCK decisions |
| State machine | All valid transitions, invalid transition guards |
| Idempotency helpers | Key generation, duplicate detection |
| Crypto utilities | Encrypt/decrypt round-trip, key validation |
| Token refresh logic | Expiry detection, refresh timing |
| Strategy revision threshold | Evidence count requirements |

### Example Unit Tests

```typescript
// policy.test.ts
describe('PolicyEngine', () => {
  it('blocks content with banned topics', async () => {
    const result = await policyEngine.evaluate({
      caption: 'Politics is everything...',
      bannedTopics: ['politics'],
    });
    expect(result.decision).toBe('block');
    expect(result.risk).toBe('high');
  });

  it('allows clean educational content', async () => {
    const result = await policyEngine.evaluate({
      caption: '3 reasons your reels stall...',
      bannedTopics: ['politics'],
    });
    expect(result.decision).toBe('allow');
    expect(result.requiresApproval).toBe(false);
  });
});

// kpi.test.ts
describe('KPI Calculations', () => {
  it('calculates engagement rate correctly', () => {
    const metrics = { likes: 100, comments: 20, shares: 30, saves: 50, reach: 1000 };
    expect(calculateEngagementRate(metrics)).toBe(0.2); // (100+20+30+50)/1000
  });

  it('returns null when reach is 0', () => {
    const metrics = { likes: 0, comments: 0, shares: 0, saves: 0, reach: 0 };
    expect(calculateEngagementRate(metrics)).toBeNull();
  });
});
```

---

## Integration Tests

Integration tests use a real PostgreSQL and Redis instance (via Docker).

### What to Integration Test

- Repository CRUD operations (all entities)
- Migration runner (up and down)
- BullMQ job enqueue and processing
- LLM adapter (mocked responses)
- Social adapter (mocked API)
- Auth flow (login → JWT → protected route)
- OAuth flow (simulate callback)

### Test Database Setup

```typescript
// test/setup.ts
import { sql } from '../src/db/client.js';

beforeAll(async () => {
  await runMigrations(); // apply all migrations
});

afterEach(async () => {
  // Truncate all tables (preserve schema)
  await sql`TRUNCATE users, social_accounts, ... CASCADE`;
});

afterAll(async () => {
  await sql.end();
});
```

### Mocking LLM Providers

```typescript
// All LLM calls should use the mockLLMProvider in tests
const mockLLM: LLMProvider = {
  generateText: vi.fn().mockResolvedValue({
    content: '{"mock": "response"}',
    model: 'mock-model',
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 100,
  }),
  generateStructured: vi.fn().mockResolvedValue({ /* typed mock */ }),
};
```

---

## End-to-End Agent Loop Test

The most important test: the full simulated loop.

```typescript
describe('Full Agent Loop (Simulated)', () => {
  it('should complete a full cycle from goal to revised strategy', async () => {
    // 1. Setup
    const account = await createTestSocialAccount();
    const goal = await createTestGoal(account.id, {
      goalType: 'GROW_ACCOUNT',
      primaryMetric: 'followers',
      target: 10000,
    });

    // 2. Run orchestrator
    const run = await orchestrator.runDailyCycle(account.id);

    // 3. Verify research was triggered
    expect(run.decisions).toContainEqual(
      expect.objectContaining({ decisionType: 'RUN_RESEARCH' })
    );

    // 4. Verify strategy was created
    const strategy = await strategyRepo.getActive(account.id);
    expect(strategy).toBeDefined();
    expect(strategy?.status).toBe('active');

    // 5. Verify content plan was generated
    const ideas = await contentIdeaRepo.getByAccount(account.id);
    expect(ideas.length).toBeGreaterThanOrEqual(3);

    // 6. Verify quality check ran
    ideas.forEach(idea => {
      expect(idea.policyDecision).toBeDefined();
    });

    // 7. Simulate publishing
    for (const idea of ideas.slice(0, 2)) {
      await publishingWorker.process({ postId: idea.postId });
    }

    // 8. Inject simulated analytics
    await simulatedAnalyticsWorker.injectMetrics({
      posts: [{ reach: 5000, shares: 200, saves: 150, follows: 40 }],
    });

    // 9. Run learning cycle
    const learningRun = await learningAgent.run(account.id);
    expect(learningRun.insights.length).toBeGreaterThan(0);

    // 10. Verify agent run recorded decisions
    const decisions = await agentRunRepo.getDecisions(run.id);
    expect(decisions.length).toBeGreaterThan(0);
    decisions.forEach(d => {
      expect(d.reasoning).toBeTruthy();
      expect(d.confidence).toBeGreaterThan(0);
    });
  });
});
```

---

## Failure Tests

### What to Test

| Failure | Expected Behavior |
|---------|------------------|
| Expired access token | Agent enters `AUTH_REQUIRED` state, sends notification |
| API timeout (Instagram) | Exponential backoff, 3 retries, then mark as transient failure |
| Rate limit response (429) | Back off for the rate-limit window, reschedule |
| Duplicate worker execution | Idempotency key prevents double-publish |
| Invalid media format | Policy check returns `block`, post marked `failed` |
| LLM malformed JSON response | Schema validation fails, falls back to deterministic defaults |
| Publishing failure after max retries | Post marked `failed`, in-app notification sent |
| Partial analytics response | Store whatever was received, flag metrics as partial |

```typescript
describe('Publishing Worker - Failure Scenarios', () => {
  it('should not publish twice when job retried', async () => {
    const igAdapter = mockInstagramAdapter();
    igAdapter.publishPost.mockResolvedValueOnce({ platformPostId: 'ig_123' });

    // Run job twice with same idempotency key
    await publishingWorker.process(job);
    await publishingWorker.process(job); // retry

    expect(igAdapter.publishPost).toHaveBeenCalledTimes(1);
  });

  it('should enter AUTH_REQUIRED state on 401', async () => {
    const igAdapter = mockInstagramAdapter();
    igAdapter.publishPost.mockRejectedValue(new UnauthorizedError('Token expired'));

    await orchestrator.runDailyCycle(accountId);

    const state = await agentStateRepo.get(accountId);
    expect(state).toBe('AUTH_REQUIRED');

    const notifications = await notificationRepo.getUnread(userId);
    expect(notifications).toContainEqual(
      expect.objectContaining({ type: 'auth_expired' })
    );
  });
});
```

---

## Simulation Mode Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        include: ['src/**/*.unit.test.ts'],
        environment: 'node',
      },
      {
        name: 'integration',
        include: ['src/**/*.integration.test.ts'],
        environment: 'node',
        globalSetup: './test/global-setup.ts',
        setupFiles: ['./test/setup.ts'],
      },
    ],
    globals: true,
  },
});
```

---

## Agent Evaluation Framework

Beyond unit/integration tests, the agent is evaluated on behavioral correctness:

| Evaluation Criterion | Method |
|---------------------|--------|
| Follows configured goal | Check decisions reference goal metric |
| Uses evidence correctly | Verify decision evidenceIds reference real records |
| Avoids fabricating metrics | Check insight statements reference real post IDs |
| Respects constraints | Verify banned topics not in generated content |
| Makes consistent decisions | Run same context twice, expect similar output |
| Avoids unnecessary strategy changes | Verify revision only after evidence threshold |
| Recognizes failed experiments | Verify rejected hypothesis leads to insight retirement |
| Improves strategy when evidence supports | Verify content mix shift correlates with insight confidence |

These are run as part of the `test:integration` suite using the simulation adapter.
