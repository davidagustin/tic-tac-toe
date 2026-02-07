# Build Guide

How I built this project from scratch -- the implementation order, what I tackled first and why, and the dependency chain that dictated the sequence. This page is structured as an answer to the interview question: **"Walk me through how you built this. What did you tackle first?"**

---

## Phase 1: Foundation (Monorepo + Shared Package)

**Why start here:** Everything depends on the shared package. Building it first means both apps can import types and game logic from day one. The monorepo structure prevents the "two repos, two versions of the same type" problem.

### Step 1: Initialize Turborepo monorepo

Set up the project with `npx create-turbo@latest`. Configure npm workspaces in the root `package.json` (`apps/*`, `packages/*`). Define the Turborepo pipeline in `turbo.json` (dev, build, lint, test tasks with correct dependency ordering so shared builds before apps).

**Key files created:** `package.json`, `turbo.json`

**Interview talking point:** "Why a monorepo?" -- A single repository gives me one version of shared types, atomic commits that span client and server, and Turborepo's build cache so unchanged packages are not rebuilt. If I had separate repos, I would need to publish the shared package to npm and coordinate version bumps across repos for every type change.

### Step 2: Set up TypeScript and tooling

Create a root `tsconfig.json` with strict mode enabled. Add Biome for linting and formatting (`biome.json`). Add Husky for git hooks and lint-staged for pre-commit checks that only run on staged files.

**Key files created:** `tsconfig.json`, `biome.json`, `.husky/pre-commit`

**Interview talking point:** "Why Biome over ESLint?" -- Biome is a single tool that replaces both ESLint and Prettier. It is written in Rust and runs 10-100x faster. For a TypeScript project, it requires zero configuration. This means faster CI runs and a simpler toolchain with one fewer dependency to maintain.

### Step 3: Build the shared package

Create `packages/shared/` with three source files. `gameLogic.ts` contains win detection (checks 8 winning line patterns), move validation (bounds, cell occupancy, turn order, game-still-active), and board utility functions. `types.ts` defines all shared types: `Player`, `Board`, `CellValue`, `GameState`, Socket.IO event maps (`ClientToServerEvents`, `ServerToClientEvents`), room types, and chat types. `constants.ts` holds configuration values: `ROOM_CONFIG`, `CHAT_CONFIG`, `REDIS_KEYS`, and `API_ROUTES`. Everything is re-exported from `index.ts`.

**Key files created:** `packages/shared/src/gameLogic.ts`, `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/index.ts`

**Interview talking point:** "Why build shared first?" -- The shared package is the contract between client and server. Types defined here prevent the two apps from disagreeing on data shapes. Game logic here means one source of truth -- the client uses it for instant UI feedback, and the server uses it for authoritative validation. If these were duplicated, a bug fix in one place but not the other would cause client/server state divergence.

### Step 4: Write tests for game logic

Write Vitest tests covering: win detection for all 8 winning lines (3 rows, 3 columns, 2 diagonals), move validation (out-of-bounds, occupied cell, wrong turn, game already over), draw detection (full board with no winner), and board state helpers. 14 tests total.

**Key files created:** `packages/shared/src/__tests__/gameLogic.test.ts`

**Interview talking point:** "Why test shared but not app code first?" -- The shared logic runs on both client and server. A bug here causes client/server disagreement on game state -- the highest-severity bug class in the system. If the client thinks X won but the server thinks the game is still in progress, the UX breaks completely. These 14 tests are the highest-value tests in the project.

---

## Phase 2: Server Core (API + Database)

**Why next:** The server must exist before the mobile app can authenticate or play online. Auth is built first because every other server feature depends on knowing who the user is.

### Step 5: Set up Docker Compose for dev

Define a `docker-compose.yml` with PostgreSQL 16 and Redis 7 containers. Add health checks so dependent services know when the databases are ready. Use persistent volumes so dev data survives container restarts.

**Key files created:** `docker-compose.yml`

**Interview talking point:** "Why Docker for dev?" -- Consistent environments across machines. No "works on my machine" problems. One command (`docker compose up -d`) gives you both databases with the correct versions. New developers can start contributing without installing PostgreSQL or Redis locally.

### Step 6: Initialize Fastify server

Create `apps/server/` and install Fastify 5. Set up the plugin architecture: CORS, formbody, cookie, rate-limit. Create a health check route (`/api/health`). Build a Zod-validated config loader that reads environment variables and fails fast with clear error messages if required values are missing.

**Key files created:** `apps/server/src/index.ts`, `apps/server/src/lib/config.ts`, `apps/server/src/routes/health.ts`

**Interview talking point:** "Why Fastify over Express?" -- Fastify's plugin system avoids Express's middleware ordering bugs (where the order of `app.use()` calls matters and causes subtle issues). Fastify is 2-3x faster in benchmarks, has built-in schema validation, and has first-class TypeScript support with typed plugins and request decorators.

### Step 7: Design and implement Prisma schema

Define the data model: `User` (email, passwordHash, name, rating, stats counters), `Account` (for OAuth providers), `RefreshToken` (token hash, expiry, userId), `Game` (playerXId, playerOId, status, winnerId, result), `Move` (gameId, position, player, moveNumber). Run `prisma migrate dev` to create the tables.

**Key files created:** `apps/server/prisma/schema.prisma`

**Interview talking point:** "Walk me through your data model." -- Users have denormalized stats counters (wins, losses, draws) for fast reads instead of counting games on every profile view. Games store the full move history as a relation, enabling replay features. Refresh tokens store SHA-256 hashes rather than raw tokens, so a database breach does not directly expose valid tokens.

### Step 8: Build auth service and routes

Implement registration (bcrypt hash at 12 rounds), login, JWT generation (15-minute access token + 7-day refresh token), refresh with rotation (delete old token, issue new pair), and logout. Add Google OAuth flow with CSRF state parameter, authorization code exchange, and deep link callback to the mobile app.

**Key files created:** `apps/server/src/services/auth.ts`, `apps/server/src/routes/auth.ts`

**Interview talking point:** "How does your auth work?" -- JWT for stateless auth so the server does not need to look up sessions on every request. Refresh token rotation prevents token reuse: when a refresh token is used, it is deleted and a new one is issued. If an attacker replays an already-rotated token, the request fails. bcrypt at 12 rounds for password hashing. OAuth uses a CSRF state parameter to prevent cross-site request forgery during the redirect flow.

### Step 9: Set up Redis client

Create an ioredis singleton with connection handling and error logging. This single client instance will be shared by the Socket.IO adapter, room service, chat service, and rate limiting. Configure connection retry strategy.

**Key files created:** `apps/server/src/lib/redis.ts`

**Interview talking point:** "Why a Redis singleton?" -- One connection pool shared across all services avoids connection exhaustion. Redis has a maximum connection limit, and each service creating its own client would multiply connections unnecessarily. The singleton also provides a single point for connection monitoring and error handling.

---

## Phase 3: Mobile Core (Screens + Local Game)

**Why now:** With the server running, the mobile app can be built. Starting with screens that do not need the server (local game) allows iterating on UI independently of backend development.

### Step 10: Initialize Expo app

Create `apps/mobile/` with Expo 52, Expo Router 4 (file-based routing), and NativeWind (Tailwind CSS for React Native). Configure the dark theme color palette in `tailwind.config.js`: background `#0a0a0a`, X mark blue `#3b82f6`, O mark rose `#f43f5e`, accent purple `#8b5cf6`. Set up `global.css` with NativeWind base styles.

**Key files created:** `apps/mobile/app.json`, `apps/mobile/tailwind.config.js`, `apps/mobile/global.css`

**Interview talking point:** "Why Expo?" -- Managed workflow handles native builds without Xcode/Android Studio configuration. Expo Router gives file-based routing like Next.js, so the route structure is visible in the file tree. OTA updates let me push fixes without going through app store review. NativeWind brings Tailwind's utility-first approach to React Native, which speeds up UI iteration.

### Step 11: Build home screen and local game

Build the home screen with navigation buttons (Local Game, Play Online, Guest). Build the local game screen using a `useLocalGame` hook that calls `@ttt/shared` game logic directly -- no server needed. Build the Board component (3x3 grid) and Cell component (with Reanimated spring animation on placement and expo-haptics tactile feedback on tap).

**Key files created:** `apps/mobile/app/index.tsx`, `apps/mobile/app/local-game.tsx`, `apps/mobile/hooks/useLocalGame.ts`, `apps/mobile/components/game/Board.tsx`, `apps/mobile/components/game/Cell.tsx`

**Interview talking point:** "Why build local game first?" -- It validates the shared game logic in a real UI with zero server dependency. I can iterate on animations, haptics, and game feel without waiting for the server to be complete. It also proves the shared package import works correctly in the Expo bundler, catching any module resolution issues early.

### Step 12: Build auth screens and store

Create a Zustand auth store with actions: `login`, `register`, `logout`, `loginAsGuest` (generates a random guest name, no server call), and `loadUser` (restores session from secure storage on app launch). Build login and register screens. Build an Axios HTTP client configured with the server base URL and automatic token refresh interceptor.

**Key files created:** `apps/mobile/stores/authStore.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/services/auth.ts`

**Interview talking point:** "Why Zustand?" -- It works outside React components, which is critical for Socket.IO callbacks that fire outside the component tree. `getState()` and `setState()` are callable from plain functions, not just hooks. No Provider wrapper needed. Only 1.2KB gzipped. Each store only triggers re-renders for its own subscribers, so updating auth state does not re-render the game board.

---

## Phase 4: Real-Time Infrastructure (Socket.IO + Lobby)

**Why now:** Auth works on both sides. Both apps can identify users. This is the phase that adds the real-time communication layer that all online features depend on.

### Step 13: Set up Socket.IO on server

Register Socket.IO as a Fastify plugin. Configure the Redis adapter for pub/sub (enables horizontal scaling later). Add auth middleware that verifies JWT tokens for logged-in users or accepts guest credentials. Set the Socket.IO path to `/api/socket.io/` so it routes correctly through Nginx.

**Key files created:** `apps/server/src/plugins/socketio.ts`

**Interview talking point:** "Why Socket.IO as a Fastify plugin?" -- It shares the same server instance, so there is no separate port to manage. Fastify lifecycle hooks handle cleanup on server shutdown. The auth context from Fastify's request decorator is available in Socket.IO middleware, avoiding duplicate auth logic.

### Step 14: Build lobby handler

Implement Socket.IO handlers for `lobby:join`, `lobby:leave`, and `lobby:chat`. When a user joins the lobby, broadcast the updated room list and online count. Redis-backed state: online count is a Redis Set (prevents duplicates), chat is a capped List (50 messages max, 24-hour TTL). Rate limit chat messages (5 per 10 seconds per user via Redis sorted sets).

**Key files created:** `apps/server/src/handlers/lobby.ts`, `apps/server/src/services/chat.ts`

**Interview talking point:** "Why Redis for lobby state?" -- Online count and chat history are ephemeral. If the server restarts, the lobby rebuilds from currently connected clients. There is no reason to persist this to PostgreSQL. Redis Sets naturally prevent counting the same user twice, and TTLs handle automatic cleanup.

### Step 15: Build Socket.IO client and lobby store

Create a singleton Socket.IO client with typed events (importing types from `@ttt/shared`). Create a Zustand lobby store (rooms list, chat messages, online count). Build a `useLobby` hook that registers socket listeners on mount and unregisters on unmount. Build the lobby screen with a room browser tab and chat tab.

**Key files created:** `apps/mobile/services/socket.ts`, `apps/mobile/stores/lobbyStore.ts`, `apps/mobile/hooks/useLobby.ts`, `apps/mobile/app/(game)/lobby.tsx`

**Interview talking point:** "Why a singleton socket?" -- One WebSocket connection per user, managed centrally. Reconnection logic lives in one place. The socket disconnects on logout and reconnects on login. Multiple components can listen to the same socket without creating duplicate connections.

---

## Phase 5: Room System + Online Game

**Why now:** The lobby is working and users can see available rooms. This phase builds the full room lifecycle and game engine that makes multiplayer work.

### Step 16: Build room service

Implement Redis-backed CRUD operations: `createRoom`, `getRoom`, `saveRoom`, `deleteRoom`, `listRooms`, `addMember`, `removeMember`, `setPlayerReady`. Rooms are stored as JSON strings with a 2-hour TTL. A separate user-to-room mapping tracks which room each user is in. Host transfer logic: if the host leaves, the next player becomes host; if no players remain, the first spectator becomes host; if the room empties, it is deleted.

**Key files created:** `apps/server/src/services/room.ts`

**Interview talking point:** "How do you handle host disconnection?" -- There is a deterministic succession order: next player slot, then first spectator. This prevents the room from becoming orphaned. The 2-hour Redis TTL acts as a safety net -- even if cleanup logic fails, the room will not persist indefinitely. All state transitions are atomic Redis operations.

### Step 17: Build room handler

Implement Socket.IO handlers for `room:create`, `room:join`, `room:leave`, `room:ready`, `room:kick`, and `room:chat`. Add the countdown system (3-2-1 then start game). Enforce guest restrictions (guests can join but cannot create rooms). Validate room passwords with bcrypt. Auto-assign users as spectators when both player slots are full.

**Key files created:** `apps/server/src/handlers/room.ts`

**Interview talking point:** "Why the ready system?" -- It prevents the jarring experience of joining a room and immediately being thrown into a match. The 3-second countdown gives both players time to prepare and creates anticipation. It also serves as a synchronization point -- both clients know exactly when the game starts.

### Step 18: Build game service and handler

Implement the game engine: `processMove()` loads game state from Redis, verifies it is the correct player's turn, validates the move via `@ttt/shared`, applies it, checks for winner or draw, and saves the updated state. `processForfeit()` ends the game with the other player as winner. `persistCompletedGame()` writes the finished game to PostgreSQL and updates user stats counters. `createRematchState()` swaps marks (X becomes O). Game handler exposes `game:move`, `game:forfeit`, and `game:rematch` events.

**Key files created:** `apps/server/src/services/game.ts`, `apps/server/src/handlers/game.ts`

**Interview talking point:** "Why validate server-side when the client already validates?" -- The server is the authority. Client-side validation exists only for optimistic UI feedback so the user sees instant response. A modified or malicious client could send invalid moves. The server must independently validate every move. This is defense in depth.

### Step 19: Build room screen and online game store

Create a Zustand room store (current room state, room chat, countdown timer). Create an online game store (board, myMark, isMyTurn, winningCells, rematch offer tracking). Build a `useRoom` hook that registers all room and game socket listeners. Build the room screen with player slots, the game board, a chat panel, and a game over modal.

**Key files created:** `apps/mobile/stores/roomStore.ts`, `apps/mobile/stores/onlineGameStore.ts`, `apps/mobile/hooks/useRoom.ts`, `apps/mobile/app/(game)/room/[id].tsx`

**Interview talking point:** "Why 3 separate stores (lobby, room, game) instead of 1?" -- Separation of concerns. When the game board updates on a move, the lobby room list does not re-render. Zustand only notifies subscribers of the specific store that changed. This prevents unnecessary re-renders in a real-time app where state changes happen frequently.

---

## Phase 6: Polish (Chat, Spectators, UX)

**Why last for features:** Core gameplay works end-to-end. This phase layers on the social features and UX polish that make the app feel complete. None of these block core functionality, so building them last reduces risk.

### Step 20: Add chat components

Build a `ChatPanel` component using FlatList with auto-scroll to newest messages. Messages from the current user are styled purple and right-aligned; messages from others are gray and left-aligned. Server-side rate limiting enforces 5 messages per 10 seconds per user via a Redis counter with 10-second TTL. The same chat component is reused in both the lobby and room screens.

**Key files created:** `apps/mobile/components/chat/ChatPanel.tsx`

### Step 21: Add spectator support

Build a `SpectatorList` component (horizontal scroll with avatar pills). Users are auto-assigned as spectators when both player slots are full. Spectators see the board in real-time but cannot make moves. When a player leaves mid-game, a spectator can be promoted to fill the empty slot.

**Key files created:** `apps/mobile/components/room/SpectatorList.tsx`, `apps/mobile/components/room/PlayerSlot.tsx`

### Step 22: Add game over modal and rematch flow

Build a `GameOverModal` with contextual messaging (win, lose, or draw). Display rematch offer tracking (shows which player has offered). Both players must agree for a rematch to start. On rematch, marks swap (X becomes O and vice versa) to keep games fair across multiple rounds.

**Key files created:** `apps/mobile/components/room/GameOverModal.tsx`

### Step 23: Add crypto donations and misc UX

Build a `CryptoDonations` component with BTC and ETH wallet addresses. Copy-to-clipboard with haptic success feedback and a checkmark animation. Add a guest upgrade banner in the lobby encouraging guests to create an account.

**Key files created:** `apps/mobile/components/CryptoDonations.tsx`

---

## Phase 7: Infrastructure (Docker, Terraform, CI/CD)

**Why last:** The application works locally and has been tested. Building infrastructure last means I am containerizing a stable, tested application rather than debugging app code and infrastructure simultaneously.

### Step 24: Write production Dockerfile

Multi-stage build. The builder stage installs all dependencies (including devDependencies), builds the shared package, generates the Prisma client, and compiles TypeScript. The runner stage copies only the compiled JavaScript and production `node_modules`. Install OpenSSL in the runner stage (Prisma's query engine links against it at runtime). Run as a non-root user. Expose port 3001.

**Key files created:** `apps/server/Dockerfile`

**Interview talking point:** "Why multi-stage?" -- The final image is roughly 60% smaller because it excludes devDependencies, TypeScript source, and build tooling. Only compiled JavaScript and production dependencies ship. The non-root user prevents container escape attacks from gaining root on the host.

### Step 25: Write production Docker Compose

Define 4 services: the application container, PostgreSQL (persistent volume, health check), Redis (AOF persistence, password auth, health check), and Nginx (SSL termination, WebSocket proxy, rate limiting). Service dependencies ensure the app waits for healthy database containers before starting.

**Key files created:** `docker-compose.prod.yml`

**Interview talking point:** "Why Docker Compose over Kubernetes?" -- This is a single-instance deployment on a free tier EC2 instance. Docker Compose is the right tool for this scale. Kubernetes would add significant operational complexity (etcd, control plane, networking) that is not justified for one server serving one application.

### Step 26: Write Terraform infrastructure

Define all AWS resources in HCL: EC2 t2.micro (free tier eligible), security group (inbound HTTP, HTTPS, and conditionally SSH), Elastic IP for a stable public address, and IAM role with SSM read access so the application can fetch secrets at runtime. Create an SSM secrets module that auto-generates database passwords, Redis auth, and JWT secrets, storing them in Parameter Store.

**Key files created:** `infra/terraform/main.tf`, `infra/terraform/modules/secrets/`

**Interview talking point:** "Why SSM Parameter Store over Secrets Manager?" -- SSM is free. Secrets Manager costs $0.40 per secret per month. Both support KMS encryption. For a portfolio project that needs to store 5-10 secrets, SSM saves $2-4/month with identical security properties. This is a pragmatic, cost-aware decision.

### Step 27: Configure Nginx

Set up HTTP-to-HTTPS redirect (except for ACME challenge paths used by Let's Encrypt). SSL termination with Let's Encrypt certificates. Reverse proxy `/api/` requests to the Fastify server. WebSocket upgrade handling for `/api/socket.io/`. Rate limiting at 10 requests per second with burst allowance.

**Key files created:** `nginx/nginx.conf`

**Interview talking point:** "Why Nginx in front of Fastify?" -- Separation of concerns. Nginx handles edge concerns: SSL termination, rate limiting, static file serving, and WebSocket upgrade negotiation. Fastify handles application logic. This means I can update SSL certificates or rate limit rules without touching application code.

### Step 28: Build CI/CD pipeline

GitHub Actions workflow with three jobs. Test: lint and test the shared package, build the shared package, generate the Prisma client, lint the server. Build: Docker build test to catch Dockerfile issues. Deploy: build and push the image to ECR, then deploy via SSH using a dynamic allow-listing strategy -- fetch the runner's public IP, add a temporary security group rule for that specific IP, SSH into the EC2 instance to pull and restart containers, then always remove the security group rule in a `finally` block.

**Key files created:** `.github/workflows/ci.yml`

**Interview talking point:** "What is the dynamic SSH trick?" -- GitHub Actions runners have ephemeral IP addresses that change every run. Instead of leaving SSH permanently open to a CIDR range, I add a temporary security group rule for the specific runner IP, deploy, then always remove it (even if the deploy fails). SSH is never persistently open to any IP address. This is defense in depth for the deployment pipeline.

---

## Summary

The build order follows a dependency chain: shared types and logic first (because both apps import from it), then server (because auth is needed before anything online), then mobile UI (local game first to validate the shared logic in a real UI without server dependency), then real-time infrastructure (Socket.IO and lobby as the foundation for online features), then the full room and game lifecycle, then polish (social features layered on after core gameplay works), and finally deployment infrastructure wrapped around the working, tested application. Each phase unblocks the next, and nothing is built before its dependencies exist.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md) | Build Guide
