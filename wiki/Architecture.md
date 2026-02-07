# Architecture -- Interview Study Guide

---

## "Walk Me Through Your Architecture"

This is the most common opening question. Here is the answer, told as a data flow narrative.

A user opens the Expo mobile app and either registers, logs in, or continues as a guest. On authentication, the client receives a JWT access token and stores it in secure storage. The app then establishes a persistent **Socket.IO** connection to the Fastify server, passing the token in the handshake. Server-side middleware validates the token before the connection is accepted -- guests authenticate with a generated ID and display name instead.

Once connected, the user joins the **lobby**, which is a Socket.IO room that broadcasts real-time updates: the current list of game rooms, an online player count, and a chat stream. All of this state lives in **Redis** -- rooms are JSON blobs with 2-hour TTLs, the room index is a Redis Set, chat history is a capped List, and the online count is derived from a Set of connected user IDs. The client subscribes to lobby events and populates a **Zustand** store, which drives the UI reactively.

When a user creates or joins a game room, they leave the lobby Socket.IO room and enter a room-specific one. The room has a lifecycle: create, join, ready up, 3-second countdown, play, game over, optional rematch. During gameplay, each move the client sends is validated server-side using the same **@ttt/shared** game logic package that the client uses for instant UI feedback. The server is the authority -- it checks turn order, cell availability, and game status before applying the move to the Redis-backed game state and broadcasting the result to the room.

When a game completes, if at least one player has a real account (not a guest), the game record and all moves are persisted to **PostgreSQL** via Prisma, and each player's stats (wins, losses, draws, rating) are updated. Guest-only games are discarded -- they exist only in Redis for the duration of the match.

---

## Key Design Decisions

### Socket.IO vs Raw WebSocket vs REST Polling

> **Q: Why did you choose Socket.IO over raw WebSockets or REST polling?**
>
> I chose Socket.IO because it gives me rooms (critical for game lobbies and individual matches), automatic reconnection with exponential backoff, and transport fallback (polling to WebSocket upgrade). Raw WebSockets would require me to build all of that from scratch. REST polling would add latency -- a move needs to reach the opponent in under 100ms, and polling at that frequency would be wasteful.
>
> **Trade-off:** Socket.IO adds ~40KB to the client bundle and has its own protocol overhead on top of WebSocket frames. For a game with low message volume, this overhead is negligible.
>
> **At scale:** Socket.IO's Redis adapter already handles multi-instance broadcasting via pub/sub. With raw WebSockets I would need to build that pub/sub layer myself or adopt something like Redis Streams.

### Redis + PostgreSQL Dual Storage vs PostgreSQL Only

> **Q: Why two databases instead of just PostgreSQL?**
>
> Rooms and active games are inherently ephemeral -- a room lives for at most 2 hours, and an active game state changes every few seconds. Writing and deleting these from PostgreSQL would create unnecessary I/O and table bloat. Redis gives me sub-millisecond reads, native TTL-based expiry (rooms auto-clean after 2 hours), and the pub/sub backbone that Socket.IO's Redis adapter needs. PostgreSQL handles what actually needs to survive a restart: user accounts, completed game history, and refresh tokens.
>
> **Trade-off:** Two databases means two failure points and two things to monitor. If Redis goes down, real-time features break even though auth still works.
>
> **At scale:** I would use **Redis Cluster** for high availability and **RDS** for managed PostgreSQL with automated backups and read replicas for stats queries.

### Shared Package (@ttt/shared) for Client + Server

> **Q: Why share game logic between client and server?**
>
> The client needs game logic for instant UI feedback -- showing the move immediately without waiting for a server round-trip. The server needs the same logic to validate moves authoritatively. If I duplicated the logic, any bug fix would need to be applied in two places, and they could drift. By extracting it into `@ttt/shared`, there is a single source of truth with its own test suite (14 Vitest tests).
>
> **Trade-off:** The shared package must be compiled before either app can build, adding a build step. Turborepo handles this dependency graph, but it is an extra moving part.
>
> **At scale:** This pattern scales well. If I added an AI opponent or a web client, they would import the same package.

### Zustand vs Redux vs Context for State Management

> **Q: Why Zustand instead of Redux or React Context?**
>
> Zustand is ~1KB, requires no providers or boilerplate, and -- critically -- **works outside React components**. My Socket.IO event handlers run outside the React tree, and they need to update state directly. With Redux I would need middleware (thunks or sagas) to bridge socket events to the store. With Context, every state update would re-render the entire subtree. Zustand's `getState()` and `setState()` can be called from any callback.
>
> **Trade-off:** Zustand has a smaller ecosystem than Redux (fewer devtools, no time-travel debugging out of the box). For a project of this size, that is not a problem.
>
> **At scale:** Zustand scales fine for mobile apps. For a complex web dashboard I might reach for Redux Toolkit for its middleware ecosystem.

### Fastify vs Express

> **Q: Why Fastify over Express?**
>
> Fastify is 2-3x faster in benchmarks, has built-in schema-based validation and serialization (I use Zod schemas), and has first-class TypeScript support with typed plugins. Express is battle-tested but shows its age -- no async error handling by default, no built-in validation, and middleware ordering is error-prone.
>
> **Trade-off:** Fastify's plugin system has a learning curve. Some Express middleware does not have Fastify equivalents, though the ecosystem has closed most gaps.
>
> **At scale:** Fastify's lower overhead means fewer instances needed for the same throughput, which reduces infrastructure cost.

### Server-Side Move Validation (Even With Client-Side Logic)

> **Q: If the client already has the game logic, why validate on the server too?**
>
> The client is untrusted. Anyone can modify the client code, intercept Socket.IO events, or send crafted payloads. The server must independently verify: is it this player's turn? Is the cell empty? Is the game still in progress? Without server validation, a player could play out of turn, overwrite cells, or continue playing after a game ends.
>
> **Trade-off:** Every move has a server round-trip before it is "official." The client optimistically shows the move for responsiveness, but the server is the source of truth.
>
> **At scale:** This pattern is non-negotiable for any competitive multiplayer game, regardless of scale.

### Redis Adapter for Socket.IO

> **Q: Why configure the Redis adapter if you are running a single server instance?**
>
> It makes horizontal scaling a deployment config change rather than a code change. When I add a second server instance behind a load balancer, Socket.IO events are already flowing through Redis pub/sub. Without the adapter, a player connected to instance A would not receive events from instance B.
>
> **Trade-off:** Slight latency overhead (events go through Redis instead of in-process). On a single instance, this is unnecessary overhead -- but it is minimal and the scaling readiness is worth it.
>
> **At scale:** This is the standard pattern. I would pair it with **sticky sessions** on the load balancer so that a client's polling-to-WebSocket upgrade hits the same instance.

---

## Room Lifecycle

```
create --> join --> ready --> countdown (3s) --> play --> game over --> rematch/leave
  |                                                          |              |
  |         (empty room)                                     |              |
  +-- delete <-----------------------------------------------+--------------+
```

### Key Interview Questions About the Lifecycle

**Q: What happens when a player disconnects mid-game?**

Socket.IO detects the disconnect via its ping/pong mechanism (25-second interval, 20-second timeout). The player's `isConnected` flag is set to `false` in the Redis room state, and a `room:player_left` event is broadcast. If the **host** disconnects, the host role transfers to the next remaining player, or to the first spectator if no players remain. If the room empties entirely, it is deleted from Redis. If they reconnect within the window, they rejoin the same room seamlessly because their user-to-room mapping still exists in Redis.

**Q: How do you handle race conditions in room state?**

Redis operations are atomic at the command level. Room state is stored as a single JSON string, so reads and writes are atomic GET/SET operations. The server is single-threaded for event processing (Node.js event loop), which naturally serializes room mutations. At scale with multiple server instances, I would use Redis transactions (MULTI/EXEC) or Lua scripts for read-modify-write operations that must be atomic across instances.

**Q: Why can't guests create rooms?**

Spam prevention. Without an account, there is no way to rate-limit room creation per user -- a guest could generate infinite IDs and flood the lobby. By restricting room creation to authenticated users, I tie the action to an identity that can be throttled or banned.

---

## State Management Deep Dive

### Why 4 Separate Stores Instead of 1?

| Store | Manages | Why Separate |
|-------|---------|-------------|
| `authStore` | User identity, tokens, guest mode | Auth state rarely changes and should not trigger game re-renders |
| `lobbyStore` | Room list, lobby chat, online count | Lobby data is irrelevant when inside a game room |
| `roomStore` | Current room state, room chat, countdown | Room state changes frequently during waiting phase |
| `onlineGameStore` | Board, myMark, isMyTurn, moves | Game state changes on every move -- must be isolated for performance |

If these were a single store, every lobby chat message would trigger a re-render of the game board. Zustand's selector-based subscriptions help, but separate stores make the boundaries explicit and impossible to accidentally cross.

### How Socket Callbacks Update Stores

Zustand stores export `getState()` and `setState()` methods that work outside React. My Socket.IO event handlers (in `useLobby.ts` and `useRoom.ts` hooks) call these directly:

```
socket.on("game:moved", (data) => {
  onlineGameStore.getState().applyMove(data);
});
```

This is the primary reason I chose Zustand over Context or a reducer-based approach -- socket events fire outside the React rendering cycle, and Zustand handles that natively.

---

## At Scale: What Changes for 10K+ Concurrent Users

| Current | At Scale |
|---------|----------|
| Single EC2 t2.micro | **ECS Fargate or EKS** with auto-scaling based on connection count |
| Single Redis instance | **Redis Cluster** (3+ nodes) for high availability and sharding |
| Single PostgreSQL | **RDS Multi-AZ** with read replicas for stats/leaderboard queries |
| Manual room creation | **Matchmaking queue** (ELO-based) with Redis Sorted Sets for ranking |
| Basic rate limiting (chat only) | **Rate limiting on all Socket.IO events** (moves, room creation, reconnects) |
| No observability | **CloudWatch metrics**, **distributed tracing** (OpenTelemetry), alerting on error rates and latency percentiles |
| Socket.IO Redis adapter | Still valid, but add **sticky sessions** on ALB and tune ping/pong intervals for connection density |
| In-memory game logic | Still valid -- tic-tac-toe is computationally trivial. For complex games, consider a dedicated game server process |

### Key Talking Point

The current architecture was designed to be **horizontally scalable without code changes**. The Redis adapter, stateless JWT auth, and externalized state (Redis + PostgreSQL) mean that adding server instances is a deployment concern, not an engineering one.

---

**Navigation:** [Home](Home.md) | Architecture | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
