# Evolvr — Autonomous AI Social-Media Employee

> **This system is not successful because it can generate good posts. It is successful when it can repeatedly make better decisions about what to post, why to post it, when to post it, how to measure it, and what to change next — while moving the account toward the owner's defined goal.**

---

## What is Evolvr?

Evolvr is a **personal autonomous social-media growth system** that operates your Instagram account like a competent full-time social-media strategist, content creator, analyst, and community manager — running on a continuous closed-loop without requiring daily human intervention.

It is **not** a content scheduler. It is **not** an analytics dashboard. It is a complete autonomous agent that:

1. Understands your growth goal
2. Builds a measurable content strategy
3. Creates content grounded in evidence
4. Publishes through official APIs
5. Measures what happened
6. Learns from the outcomes
7. Revises the strategy based on evidence
8. Repeats

---

## Quick Start (Local Development)

### Prerequisites

- Node.js v22+
- pnpm v10+
- Docker Desktop

### Setup

```bash
# 1. Clone the repository
git clone <repo-url> evolvr
cd evolvr

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and ENCRYPTION_KEY

# 4. Start infrastructure
docker compose up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Seed initial admin user
pnpm db:seed

# 7. Start development servers
pnpm dev
```

This starts:
- **API**: http://localhost:3001
- **Web Dashboard**: http://localhost:3000
- **pgAdmin**: http://localhost:5050 (with `--profile tools`)

Default admin credentials are printed by the seed script. **Change them immediately.**

### Environment Variables

Copy `.env.example` to `.env`. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for detailed setup instructions for each external service.

Key variables to set for minimum functionality:

```bash
JWT_SECRET=<random 32+ char string>
ENCRYPTION_KEY=<64-char hex string, see .env.example for generation command>
# LLM (OpenRouter is default)
OPENROUTER_API_KEY=<your key>
# Simulation mode is ON by default — no Instagram credentials needed
SIMULATION_MODE=true
```

### Running Without Real Instagram Credentials

By default, `SIMULATION_MODE=true`. The system will use a simulated Instagram adapter that generates realistic fake metrics. This is the recommended way to develop and test the full agent loop without touching a real account.

---

## Project Structure

```
evolvr/
├── apps/
│   ├── api/          # Fastify backend — agent, workers, API
│   └── web/          # Next.js 14 — admin dashboard
├── packages/
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared ESLint, TSConfig, Prettier
├── docs/             # Architecture, design, and ops docs
├── docker-compose.yml
└── .env.example
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture with diagrams |
| [AGENT_DESIGN.md](docs/AGENT_DESIGN.md) | Agents, tools, state machine, decision loop |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Database schema, entity relationships |
| [INTEGRATIONS.md](docs/INTEGRATIONS.md) | External service setup (Meta, LLM, Research) |
| [AUTONOMY_POLICY.md](docs/AUTONOMY_POLICY.md) | Which actions are autonomous vs approval-required |
| [PROMPTS.md](docs/PROMPTS.md) | LLM prompt templates and versioning |
| [OPERATIONS.md](docs/OPERATIONS.md) | Deployment, monitoring, backup |
| [TESTING.md](docs/TESTING.md) | Test strategy and commands |
| [ROADMAP.md](docs/ROADMAP.md) | Phased development roadmap |

---

## Core Principle

> Build the complete closed-loop autonomous growth system. Not a content generator. Not a scheduler. Not a dashboard.
