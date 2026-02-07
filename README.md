# Tic-Tac-Toe

**Real-time multiplayer tic-tac-toe -- an interview study guide.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-52-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<!-- TODO: screenshots -->

---

## The 30-Second Pitch

This is a real-time multiplayer tic-tac-toe mobile app built as a Turborepo monorepo with an Expo client, Fastify server, and a shared game logic package. It features Socket.IO for sub-100ms gameplay, a dual-storage pattern (Redis for ephemeral state, PostgreSQL for persistence), JWT auth with refresh token rotation, and a full CI/CD pipeline deploying via Docker to AWS. I built it to demonstrate real-time architecture, mobile development, and infrastructure-as-code in a single cohesive project.

**Feature highlights:** local pass-and-play, online multiplayer with room browser, spectator mode (up to 8 per room), lobby and per-room chat, ready-up countdown, rematch with mark swap, forfeit, email/password and Google OAuth, guest mode, game persistence with stats tracking, haptic feedback, spring animations, and a full CI/CD pipeline to AWS.

---

## Architecture Overview

```
                         +-----------+
                         |   Mobile  |
                         |  (Expo)   |
                         +-----+-----+
                               |
                    Socket.IO / HTTP
                               |
                         +-----v-----+
                   +---->|   Nginx   |<----+
                   |     | (reverse  |     |
                   |     |  proxy)   |     |
                   |     +-----+-----+     |
                   |           |           |
              WebSocket    REST API    Static
                   |           |           |
                   +-----+-----+-----------+
                         |
                   +-----v-----+
                   |  Fastify  |
                   |  Server   |
                   +--+-----+--+
                      |     |
             +--------+     +--------+
             |                       |
       +-----v-----+          +-----v-----+
       |   Redis    |          | PostgreSQL|
       | (ephemeral)|          |(persistent)|
       +-----------+          +-----------+
        - Active rooms         - User accounts
        - Game state           - Completed games
        - Presence             - Move history
        - Chat messages        - Player stats
        - Room TTLs            - OAuth accounts
```

### Key Design Decisions

Every technical choice involves trade-offs. These are the decisions I made, the reasoning behind them, and the alternatives I considered. This is the section to review before an interview -- each entry maps to a common system design question.

**Socket.IO over raw WebSocket or REST polling**
- **What I chose:** Socket.IO for all real-time game communication.
- **Why:** Games need sub-100ms latency. Socket.IO gives me persistent connections, built-in rooms (perfect for game lobbies), automatic reconnection, and transparent fallback to long-polling if WebSocket fails.
- **Alternative considered:** Raw WebSocket would be lighter, but I would have had to build rooms, reconnection, and event acknowledgment from scratch.

**Dual-storage pattern (Redis + PostgreSQL)**
- **What I chose:** Redis for all ephemeral state (active rooms, in-progress games, presence, chat). PostgreSQL for persistent data (user accounts, completed games, stats).
- **Why:** Rooms are inherently temporary (2-hour TTL). Writing and deleting short-lived data to PostgreSQL would mean unnecessary disk I/O. Redis gives sub-millisecond reads and automatic TTL expiry. PostgreSQL is reserved for data that must survive restarts.
- **Alternative considered:** PostgreSQL for everything -- simpler operationally, but adds latency to every real-time operation.

**Shared game logic package (@ttt/shared)**
- **What I chose:** A shared Turborepo package containing win detection, move validation, types, and constants, imported by both client and server.
- **Why:** The client needs game logic for **instant UI feedback** (optimistic updates). The server needs the same logic as the **authoritative source of truth**. Duplicating it would risk client/server disagreement. This is the **shared kernel** pattern.
- **Alternative considered:** Duplicating logic in each app -- faster to set up, but a maintenance and correctness liability.

**Zustand over Redux or React Context**
- **What I chose:** Zustand for all client-side state (4 stores: auth, lobby, room, game).
- **Why:** Minimal boilerplate, no Provider wrapper needed, works outside React components (critical for Socket.IO callbacks that fire outside the component tree), and is only 1.2KB gzipped.
- **Alternative considered:** Redux (overkill for 4 small stores), React Context (causes unnecessary re-renders on state changes).

**Fastify over Express**
- **What I chose:** Fastify 5 as the HTTP/WebSocket server.
- **Why:** 2-3x faster than Express in benchmarks, built-in schema validation via JSON Schema, first-class TypeScript support, and a plugin architecture that avoids Express's middleware ordering pitfalls.
- **Alternative considered:** Express -- larger ecosystem and more tutorials, but slower and weaker TypeScript support.

**Guest mode with restricted permissions**
- **What I chose:** Guests can join and play in rooms but cannot create rooms.
- **Why:** This lowers the barrier to play (no signup required) while preventing spam room creation. Guest users get a random name and in-memory ID with no database record, so guest-only games are not persisted (privacy and cost).
- **Alternative considered:** Requiring signup for all users -- simpler auth logic, but adds friction for casual players.

**JWT with refresh token rotation**
- **What I chose:** Short-lived access tokens (15 minutes) paired with long-lived refresh tokens (7 days) that are rotated on each use.
- **Why:** Short access tokens limit the damage window if a token is stolen. Refresh token rotation means each token can only be used once -- the old token is deleted when a new one is issued, which prevents **token reuse attacks**.
- **Alternative considered:** Long-lived access tokens (simpler, but higher risk if compromised).

**Server-side move validation**
- **What I chose:** The server re-validates every game move, even though the client has the same game logic.
- **Why:** The server is the **single source of truth**. Client-side validation exists only for instant UI feedback. A malicious client could send invalid moves -- the server must reject them. This is the **trust but verify** pattern.
- **Alternative considered:** Trusting client-side validation only -- faster to implement, but trivially exploitable.

**nanoid v3 (not v4) for room IDs**
- **What I chose:** nanoid version 3, pinned explicitly.
- **Why:** v4+ is ESM-only, which breaks `tsx` (the TypeScript runtime used for dev). v3 is the last CJS-compatible version. This is a **practical compatibility decision** -- the kind of thing you only learn by hitting the error.
- **Alternative considered:** uuid (larger output, no real benefit for short-lived room IDs).

**Terraform for infrastructure**
- **What I chose:** All AWS resources (EC2, security groups, SSM parameters) defined in Terraform HCL files.
- **Why:** Infrastructure-as-code means reproducible deployments, version-controlled infrastructure, and no manual console clicking. Even for a single EC2 instance, this demonstrates production-grade practices and makes teardown/recreation trivial.
- **Alternative considered:** AWS CDK (more powerful, but heavier dependency for a small footprint), or manual console setup (faster initially, but not reproducible).

**Biome over ESLint + Prettier**
- **What I chose:** Biome as the single linter and formatter.
- **Why:** One tool replaces two, runs 10-100x faster (Rust-based), and requires zero configuration for TypeScript projects. Faster CI runs, simpler toolchain.
- **Alternative considered:** ESLint + Prettier (larger rule ecosystem, but two tools to configure and slower execution).

---

## Technical Highlights

These are the engineering details worth discussing in depth. Each one is a self-contained talking point you can bring up when asked "what was technically interesting about this project?"

> **Typed Socket.IO events across client and server**
> I defined TypeScript interfaces for every Socket.IO event in the shared package (`ClientToServerEvents`, `ServerToClientEvents`). Both the server's event handlers and the client's socket instance are typed against these interfaces, so a typo in an event name or a wrong payload shape is a compile-time error, not a runtime bug. This eliminates an entire class of real-time communication bugs.

> **Redis adapter for horizontal scaling**
> The Socket.IO server uses `@socket.io/redis-adapter`, which routes events through Redis pub/sub. If two players are connected to different server instances, their events still reach each other because both instances subscribe to the same Redis channels. The project runs on a single EC2 instance today, but adding instances behind a load balancer requires zero code changes -- only infrastructure configuration.

> **Multi-stage Docker build**
> The Dockerfile uses a two-stage approach. The builder stage installs all dependencies (including devDependencies) and compiles TypeScript. The runner stage copies only the compiled JavaScript and production node_modules. This reduces the final image size by roughly 60%. One gotcha: OpenSSL must be installed in the runner stage because Prisma's query engine links against it at runtime.

> **Terraform infrastructure-as-code**
> All AWS resources (EC2 instance, security groups, SSM parameters) are defined in Terraform HCL files. The entire infrastructure can be created with `terraform apply` and destroyed with `terraform destroy`. I chose SSM Parameter Store over Secrets Manager for secrets because SSM is free tier ($0 vs $0.40/secret/month) -- both support KMS encryption.

> **CI/CD with dynamic SSH allow-listing**
> The GitHub Actions deploy workflow has a security-conscious SSH strategy. It fetches the runner's public IP via an API call, temporarily adds an inbound SSH rule to the EC2 security group for that specific IP, runs the deployment over SSH, then removes the rule in a `finally` block. This means SSH is never persistently open to any IP range.

> **Refresh token rotation**
> When a client uses a refresh token to get a new access token, the server deletes the old refresh token and issues a new one. If an attacker steals and replays a refresh token that has already been rotated, the request fails because the token no longer exists in the database. This is a standard defense against **token replay attacks**.

> **Chat rate limiting via Redis**
> Per-room chat enforces a sliding window rate limit of 5 messages per 10 seconds per user. The implementation uses Redis sorted sets with timestamps as scores. On each message, expired entries are pruned, the current count is checked, and the new entry is added -- all in a single pipeline call. The rate limit state auto-expires with the room's TTL, so there is no cleanup needed.

> **Room lifecycle state machine**
> Rooms progress through defined states: `create -> join -> ready -> countdown -> play -> game over -> rematch/leave`. The ready-up system prevents the jarring experience of joining a room and immediately being thrown into a match. The 3-second countdown gives both players time to prepare. On rematch, marks swap (X becomes O and vice versa) to keep games fair across multiple rounds.

> **Shared game logic kernel**
> Win detection checks the board against 8 predefined winning line patterns (3 rows, 3 columns, 2 diagonals). Move validation verifies bounds, cell vacancy, correct turn order, and that the game is still active. This logic runs identically on client (for optimistic UI updates with zero perceived latency) and server (as the authoritative validator), imported from a single source in `@ttt/shared`.

---

## What I'd Do Differently at Scale

If this needed to handle 10K+ concurrent users, here is how the architecture would evolve. This section shows interviewers you understand the limits of your current design.

- **Matchmaking queue** -- Replace manual room creation with an ELO-based matchmaking system using a Redis sorted set. Players join a queue, and a background worker pairs players of similar rating. This removes the friction of browsing and joining rooms manually.
- **Redis Cluster** -- Move from a single Redis instance to a Redis Cluster (minimum 3 primaries + 3 replicas) for high availability and automatic failover. The Socket.IO Redis adapter already supports cluster mode.
- **Rate limiting on all Socket.IO events** -- Currently only chat is rate-limited. At scale, every event type (move, ready, join, spectate) needs per-user throttling to prevent abuse and accidental DDoS from buggy clients.
- **Container orchestration (ECS/EKS)** -- Replace the single EC2 instance with ECS Fargate or EKS. This gives auto-scaling based on WebSocket connection count, zero-downtime rolling deploys, and automatic container health checks.
- **Observability stack** -- Add structured JSON logging, distributed tracing (OpenTelemetry), and dashboards (Grafana or Datadog). Key metrics to track: Socket.IO connection count, event latency P50/P95/P99, Redis memory usage, room creation rate, and game completion rate.
- **AI opponent (minimax)** -- Implement a minimax algorithm with alpha-beta pruning for single-player mode. Difficulty levels would control search depth: easy (depth 1-2, random mistakes), medium (depth 4-5), impossible (full search, always ties or wins).
- **WebSocket heartbeat monitoring** -- Add active ping/pong health checks beyond Socket.IO's built-in timeout to detect and clean up zombie connections faster, reclaiming server resources.
- **CDN for static assets** -- Serve any web-accessible static content through CloudFront, reducing origin server load and improving latency for geographically distributed users.
- **Database read replicas** -- Add a PostgreSQL read replica for stats queries and leaderboards, keeping write traffic isolated to the primary instance.
- **Connection pooling** -- Add PgBouncer in front of PostgreSQL to handle connection pooling, preventing the "too many connections" problem as server instances scale out.

The key takeaway: the current architecture is intentionally over-engineered for a tic-tac-toe game because the goal is to demonstrate patterns that apply to any real-time system at scale.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Monorepo | Turborepo 2.0, npm workspaces | Build orchestration, workspace management |
| Mobile | Expo 52, Expo Router 4, React Native 0.76 | Cross-platform app (iOS / Android / Web) |
| Styling | NativeWind 4.1 (Tailwind CSS) | Utility-first styling with dark theme |
| State | Zustand 4.5 | Client-side state management |
| Animation | Reanimated 3.16, expo-haptics | Physics-based animations, tactile feedback |
| Server | Fastify 5 | HTTP API and plugin host |
| Real-time | Socket.IO 4.8 + Redis adapter | WebSocket rooms, events, horizontal scaling |
| Database | PostgreSQL 16, Prisma 5.20 | User accounts, completed game persistence |
| Cache | Redis 7, ioredis | Ephemeral state (rooms, presence, chat) |
| Auth | @fastify/jwt, bcryptjs, google-auth-library | JWT tokens, password hashing, OAuth |
| Validation | Zod 3.23 | Runtime schema validation |
| Quality | Biome, TypeScript strict, Vitest, Husky | Linting, formatting, testing, pre-commit hooks |
| Infra | Docker, Terraform, Nginx, GitHub Actions | Containerization, IaC, reverse proxy, CI/CD |

---

## Project Structure

```
tic-tac-toe/
├── apps/
│   ├── mobile/                # Expo React Native app
│   │   ├── app/               #   Expo Router screens (file-based routing)
│   │   ├── components/        #   Reusable UI components
│   │   ├── hooks/             #   Socket.IO listeners (useLobby, useRoom)
│   │   ├── services/          #   API client, Socket.IO singleton
│   │   └── stores/            #   Zustand stores (auth, lobby, room, game)
│   └── server/                # Fastify API + Socket.IO server
│       ├── prisma/            #   Schema, migrations, seed
│       ├── src/
│       │   ├── handlers/      #   Socket.IO event handlers (lobby, room, game)
│       │   ├── plugins/       #   Fastify plugins (CORS, JWT, Socket.IO)
│       │   ├── routes/        #   HTTP routes (auth, health)
│       │   ├── services/      #   Business logic (room, game, chat, auth)
│       │   └── lib/           #   Redis client, utilities
│       └── Dockerfile         #   Multi-stage production build
├── packages/
│   └── shared/                # @ttt/shared - shared across all apps
│       └── src/
│           ├── gameLogic.ts   #   Win detection, move validation
│           ├── types.ts       #   Socket.IO event maps, room/chat types
│           ├── constants.ts   #   Room config, chat config, Redis keys
│           └── __tests__/     #   Vitest unit tests (14 tests)
├── infra/
│   └── terraform/             # AWS infrastructure (EC2, SSM, security groups)
├── nginx/                     # Reverse proxy config + SSL termination
├── .github/workflows/         # CI/CD pipeline (test, build, deploy)
├── docker-compose.yml         # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml    # Prod: App + PostgreSQL + Redis + Nginx
└── turbo.json                 # Turborepo pipeline configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Docker** and **Docker Compose**
- **Expo CLI** (`npx expo`)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/tic-tac-toe.git
cd tic-tac-toe

# Install dependencies
npm install

# Start PostgreSQL and Redis
docker compose up -d

# Configure environment
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your secrets

# Run database migrations
npm run -w @ttt/server db:migrate

# Start all workspaces in dev mode
npm run dev
```

The server runs on `http://localhost:3001` and the Expo dev server starts for mobile.

### Available Scripts

Run from the repository root:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all workspaces in development mode |
| `npm run build` | Build all workspaces |
| `npm run lint` | TypeScript type-check all workspaces |
| `npm run test` | Run all tests (Vitest) |
| `npm run lint:biome` | Lint with Biome |
| `npm run format` | Auto-format with Biome |
| `npm run validate` | Full validation (TypeScript + Biome) |

---

## Testing

Tests live in `packages/shared` and cover the core game logic: win detection across all 8 lines, move validation (bounds, occupancy, turn order), draw detection, and board state management. There are 14 unit tests using Vitest.

The shared package is the most critical code to test because it runs on both client and server. A bug here would cause client/server disagreement on game state.

```bash
# Run all tests via Turborepo
npm run test

# Run shared package tests directly
npm run -w @ttt/shared test

# Run with watch mode during development
npm run -w @ttt/shared test -- --watch
```

---

## License

MIT
