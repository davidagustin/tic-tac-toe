# Architecture Deep Dive

Detailed documentation of the system architecture, data flow, and design decisions behind the Tic-Tac-Toe Online project.

## System Overview

The project is a **Turborepo monorepo** with three workspaces:

| Workspace | Package Name | Purpose |
|-----------|-------------|---------|
| `apps/mobile` | `@ttt/mobile` | Expo 52 mobile app with Expo Router 4, NativeWind, Zustand, Reanimated, socket.io-client |
| `apps/server` | `@ttt/server` | Fastify 5 API server with Socket.IO 4.8.3, Prisma 5.20, ioredis, @fastify/jwt, Zod |
| `packages/shared` | `@ttt/shared` | Game logic, TypeScript types, Socket.IO event maps, constants |

### Dependency Graph

```
@ttt/mobile ──imports──> @ttt/shared
@ttt/server ──imports──> @ttt/shared
```

Server and mobile never import from each other. All shared logic lives in `@ttt/shared`.

### Build Tooling

| Tool | Role |
|------|------|
| Turborepo | Monorepo task orchestration (`dev`, `build`, `lint`, `test`) |
| Biome | Linting and formatting (replaces ESLint + Prettier) |
| Husky + lint-staged | Pre-commit hooks running Biome checks |
| TypeScript 5.4+ | Strict mode enabled in all workspaces |
| Vitest | Unit testing for shared package |

---

## Dual-Storage Pattern

The application uses two databases with distinct responsibilities:

### Redis (Ephemeral State)

Redis handles all real-time, short-lived data that does not need long-term persistence:

| Data | Redis Key Pattern | TTL | Purpose |
|------|-------------------|-----|---------|
| Room state | `room:{roomId}` | 2 hours | Full room detail + password hash |
| Active room list | `rooms` (Set) | -- | Set of all active room IDs |
| User-to-room mapping | `user:room:{userId}` | 2 hours | Which room a user is currently in |
| Active game state | `game:state:{roomId}` | 2 hours | Board, turns, players, moves |
| Lobby chat | `lobby:chat` (List) | 24 hours | Last 50 lobby messages |
| Room chat | `room:chat:{roomId}` (List) | 24 hours | Last 50 room messages |
| Online users | `lobby:online` (Set) | -- | Set of connected user IDs |
| Chat rate limit | `chat:rate:{userId}` | 10 seconds | Message count for rate limiting |

**Why Redis?** Rooms and active games are inherently temporary. Redis provides sub-millisecond reads, automatic expiry via TTLs, and the pub/sub backbone for Socket.IO's Redis adapter.

### PostgreSQL / Prisma (Persistent State)

PostgreSQL stores data that must survive server restarts:

| Data | Purpose |
|------|---------|
| User accounts | Registration, OAuth links, profile |
| Refresh tokens | JWT refresh token rotation |
| Completed games | Game history with full move sequence |
| User stats | Wins, losses, draws, rating, games played |

**Guest-only games are NOT persisted.** If both players are guests (userId starts with `guest_`), the game is played entirely in Redis and discarded on completion. This reduces database load and respects guest privacy.

---

## Real-time Architecture

### Socket.IO Setup

Socket.IO is registered as a Fastify plugin at path `/api/socket.io/`. Configuration:

```
Path:          /api/socket.io/
Transports:    websocket, polling
Ping interval: 25,000ms
Ping timeout:  20,000ms
CORS:          Development: all origins | Production: https://game-practice-aws.com
```

### Redis Adapter

The server uses `@socket.io/redis-adapter` with dedicated pub/sub Redis clients. This enables horizontal scaling: multiple server instances share Socket.IO events through Redis pub/sub.

```
Client <──WebSocket──> Nginx <──proxy──> Fastify + Socket.IO
                                              |
                                        Redis Adapter
                                         /        \
                                   Redis Pub    Redis Sub
```

### Authentication Middleware

Socket.IO connections are authenticated via middleware that runs before the `connection` event:

| Auth Method | How It Works |
|-------------|-------------|
| JWT Token | Client sends `token` in `handshake.auth`. Server verifies with `@fastify/jwt`. User name and rating loaded from PostgreSQL. |
| Guest | Client sends `guestId` + `guestName` in `handshake.auth`. No database lookup. Rating defaults to 1000. |
| No credentials | Connection rejected with `"Authentication required"` error. |

### Reconnection

The client is configured for automatic reconnection:

| Parameter | Value |
|-----------|-------|
| Max attempts | 10 |
| Delay | 1-5 seconds (exponential backoff) |

On reconnect, the client re-authenticates and re-joins its previous lobby or room.

### Typed Events

All Socket.IO events are fully typed via `ClientToServerEvents` and `ServerToClientEvents` interfaces exported from `@ttt/shared`. Both the server and mobile client import these types, ensuring compile-time safety for event names and payloads.

---

## Room Lifecycle

```
create --> join --> ready --> countdown (3s) --> play --> game over --> rematch/leave
  |                                                          |              |
  |         (empty room)                                     |              |
  +-- delete <-----------------------------------------------+--------------+
```

### Lifecycle Stages

| Stage | Description |
|-------|-------------|
| **Create** | Host creates room with a name and optional password. Room stored in Redis with 2-hour TTL. Host is assigned mark X. Guests cannot create rooms. |
| **Join** | Second player joins as O. Spectators (up to 8) can also join. Password validated if set. |
| **Ready** | Both players toggle ready. When both are ready, countdown begins. |
| **Countdown** | 3-second countdown broadcast to room (`room:countdown` events: 3, 2, 1). |
| **Play** | Game state created in Redis. Moves validated server-side. Board state broadcast after each move. |
| **Game Over** | Winner determined, `game:over` emitted. Game persisted to PostgreSQL (if not guest-only). Room returns to waiting status. |
| **Rematch** | Either player requests rematch. When both agree, marks swap (X becomes O, O becomes X) and a new game starts. |
| **Leave** | Player leaves room. If host leaves, host transfers to next player or spectator. If room empties, it is deleted. |

### Room Capacity

| Role | Max |
|------|-----|
| Players | 2 |
| Spectators | 8 |
| Total | 10 |

### Host Rules

- Host is always the room creator (initially)
- Host is always assigned mark X
- Host can kick players before the game starts
- If host disconnects, host role transfers to: first remaining player, or first spectator
- When a spectator becomes host and there are no other players, they are promoted to the player slot with mark X

---

## Game Engine

### Shared Game Logic (`@ttt/shared`)

All game logic is pure TypeScript in `packages/shared/src/gameLogic.ts`:

| Function | Purpose |
|----------|---------|
| `isValidMove(board, position)` | Check if a cell is empty and position is 0-8 |
| `applyMove(board, position, player)` | Return new board with move applied (immutable) |
| `checkWinner(board)` | Return winning player (`X` or `O`) or `null` |
| `getWinningCells(board)` | Return array of 3 winning cell indices, or `null` |
| `isBoardFull(board)` | Check if all 9 cells are occupied (draw condition) |
| `getGameStatus(board)` | Return `in_progress`, `x_wins`, `o_wins`, or `draw` |
| `getNextTurn(currentTurn)` | Toggle between `X` and `O` |
| `getMoveCount(board)` | Count non-null cells |
| `getAvailableMoves(board)` | Return array of empty cell indices |
| `getCurrentTurn(board)` | Determine whose turn it is from move count (X goes first) |

The board is a flat array of 9 cells (indices 0-8), each `null`, `"X"`, or `"O"`.

Win combinations:
```
[0,1,2] top row       [0,3,6] left col     [0,4,8] diagonal \
[3,4,5] middle row    [1,4,7] middle col   [2,4,6] diagonal /
[6,7,8] bottom row    [2,5,8] right col
```

### Server-Side Validation

The server is the authority. Every move goes through `processMove()`:

1. Load game state from Redis
2. Verify game is `in_progress`
3. Verify it is the requesting player's turn
4. Validate the move via `isValidMove()`
5. Apply the move via `applyMove()`
6. Check for winner or draw
7. Save updated state to Redis
8. Return result (state, gameOver flag, winner, winningCells)

Invalid moves are rejected with an error event back to the client.

### Game Persistence

On game completion:

1. If both players are guests, skip persistence entirely
2. Create a `Game` record in PostgreSQL with all moves
3. Update each non-guest player's stats: increment `gamesPlayed`, and `wins`/`losses`/`draws` as appropriate
4. On forfeit, the forfeiting player gets a loss and the opponent gets a win

### Rematch

When both players agree to rematch:

1. Marks are swapped (X becomes O, O becomes X)
2. A fresh game state is created in Redis
3. `game:rematch_start` is broadcast to the room with the new state
4. Room status changes back to `playing`

---

## State Management (Mobile)

### Zustand Stores

| Store | File | Purpose |
|-------|------|---------|
| `authStore` | `stores/authStore.ts` | Auth state, tokens, guest mode (`loginAsGuest()`) |
| `lobbyStore` | `stores/lobbyStore.ts` | Room list, lobby chat messages, online player count |
| `roomStore` | `stores/roomStore.ts` | Current room state, room chat, countdown state |
| `onlineGameStore` | `stores/onlineGameStore.ts` | Active game board, `myMark`, `isMyTurn`, moves |

### Socket.IO Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useLobby` | `hooks/useLobby.ts` | Register/unregister lobby socket listeners, provide lobby actions (join, leave, chat) |
| `useRoom` | `hooks/useRoom.ts` | Register/unregister room + game socket listeners, provide room actions (create, join, ready, kick, move, forfeit, rematch) |

### Offline Play

The `useLocalGame` hook handles local (offline) play using `@ttt/shared` game logic directly. No server connection required. Two players share the same device.

### Socket Client

A singleton Socket.IO client at `services/socket.ts` manages the connection lifecycle. It connects on login (or guest mode activation) and disconnects on logout.

---

## Configuration

### Server Environment Variables

Validated at startup via Zod schema in `apps/server/src/lib/config.ts`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `NODE_ENV` | No | `development` | Environment |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | -- | JWT signing secret (min 16 chars) |
| `JWT_REFRESH_SECRET` | Yes | -- | Refresh token secret (min 16 chars) |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token TTL |
| `GOOGLE_CLIENT_ID` | No | -- | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | -- | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | -- | Google OAuth redirect URI |

### Game Constants

Defined in `packages/shared/src/constants.ts`:

| Constant | Value |
|----------|-------|
| `GAME_CONFIG.DISCONNECT_TIMEOUT_SECONDS` | 30 |
| `GAME_CONFIG.GAME_TTL_SECONDS` | 3600 (1 hour) |
| `GAME_CONFIG.COUNTDOWN_SECONDS` | 3 |
| `GAME_CONFIG.INITIAL_RATING` | 1000 |
| `GAME_CONFIG.RATING_K_FACTOR` | 32 |
| `ROOM_CONFIG.MAX_PLAYERS` | 2 |
| `ROOM_CONFIG.MAX_SPECTATORS` | 8 |
| `ROOM_CONFIG.ROOM_TTL_SECONDS` | 7200 (2 hours) |
| `ROOM_CONFIG.ROOM_CODE_LENGTH` | 8 |
| `CHAT_CONFIG.MAX_MESSAGE_LENGTH` | 200 |
| `CHAT_CONFIG.MAX_HISTORY` | 50 |
| `CHAT_CONFIG.RATE_LIMIT_MESSAGES` | 5 per 10 seconds |

---

**Navigation:** [Home](Home.md) | Architecture | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
