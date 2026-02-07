# Database Schema -- Interview Study Guide

---

## "Walk Me Through Your Data Model"

This is the answer to give when an interviewer asks about your data design.

I use a **dual-storage pattern**: Redis for ephemeral real-time state and PostgreSQL (via Prisma ORM) for persistent data. The key insight is that different data has different lifespans and access patterns, and forcing everything into one database creates unnecessary trade-offs.

**Redis** holds everything that is temporary and latency-sensitive: active game rooms (2-hour TTL), in-progress game state, lobby and room chat (24-hour TTL), online presence, and rate-limiting counters. These are read and written on every socket event, often multiple times per second per room. Redis gives me sub-millisecond access, native TTL expiry (rooms auto-clean without a cron job), and the pub/sub backbone for Socket.IO's multi-instance adapter.

**PostgreSQL** holds everything that must survive a server restart: user accounts (email, password hash, OAuth links), completed game records with full move history, user stats (wins, losses, draws, rating), and refresh token hashes. These are written infrequently -- only on registration, login, game completion, and token rotation -- but must be durable and queryable.

**Guest-only games are not persisted.** If both players are guests, the game exists only in Redis and is discarded on completion. This avoids orphan records (no user ID to link to), respects guest privacy, and reduces unnecessary database writes.

---

## Schema Design Decisions

### Q: "Why two databases instead of one?"

Redis for ephemeral real-time state (rooms, active games, chat) gives me sub-millisecond reads and automatic expiry via TTLs. PostgreSQL for persistent data (users, completed games, stats) gives me ACID guarantees, relational integrity, and SQL for complex queries. Rooms have a 2-hour lifespan -- writing and deleting them in PostgreSQL would be wasteful I/O and create table bloat. A room might be read 100 times and written to 50 times during its life, then deleted. Redis handles this naturally; PostgreSQL would need periodic cleanup jobs.

**Trade-off:** Two databases means two failure modes. If Redis goes down, all real-time features break even though auth and history still work. This could be mitigated with Redis Sentinel or Cluster for HA.

**At scale:** I would use **ElastiCache** for managed Redis (automatic failover) and **RDS** for managed PostgreSQL (automated backups, multi-AZ).

---

### Q: "Why not persist guest games?"

Guest users have no account -- their `userId` is a randomly generated string prefixed with `guest_`. Persisting their games would create orphan records with no real user to link to. If the same person plays as a guest twice, there is no way to associate the games. It also respects privacy -- guests have not opted into tracking. Finally, it reduces database writes. In a lobby with many casual players, most games might be guest-only.

**Trade-off:** No game history or stats for guests. This is intentional -- it incentivizes account creation.

---

### Q: "How does refresh token rotation work in the schema?"

The `RefreshToken` table stores **SHA-256 hashes**, not raw tokens. Here is the flow:

1. On login/register, the server generates a random 64-byte token, hashes it with SHA-256, and stores the hash in the database.
2. The raw token is sent to the client (in the response body and as an httpOnly cookie).
3. When the client needs a new access token, it sends the raw refresh token.
4. The server hashes the received token and looks up the hash in the database.
5. If found, the old hash is **deleted** and a new token pair is generated (rotation).

If an attacker steals a refresh token **after** the legitimate user has already used it to refresh, the stolen token's hash no longer exists in the database -- it is already invalid. If the attacker uses it **first**, the legitimate user's next refresh fails, which signals compromise.

**Trade-off:** Each refresh requires a database write (delete old + insert new). At 15-minute access token lifetimes, this is roughly 4 writes per user per hour -- negligible.

---

### Q: "Why store full move history?"

Each `Move` record is ~40 bytes (player mark, position 0-8, move number, timestamp). A tic-tac-toe game has at most 9 moves. Storing full history enables:

- **Game replay**: Show a step-by-step playback of any completed game.
- **Cheat detection**: Validate that the move sequence is legal (no skipped turns, no overwritten cells).
- **Analytics**: Identify common opening moves, win rates by position, average game length.

**Trade-off:** Slightly more storage than just storing the final board state. But at ~360 bytes per game maximum, it is negligible even at millions of games.

---

### Q: "Why CUID over UUID for primary keys?"

CUIDs are **sortable by creation time** (the timestamp is embedded in the prefix), which means an `ORDER BY id` query returns records in chronological order -- useful for pagination without a separate `createdAt` index. They are collision-resistant (safe for distributed generation without coordination), shorter than UUIDv4, and are Prisma's default ID strategy.

**Trade-off:** CUIDs are not a standard like UUID. If I needed to integrate with external systems that expect UUIDs, I would need to convert. For an internal-only primary key, CUIDs are the better choice.

---

### Q: "Why is `passwordHash` nullable on the User model?"

OAuth-only users (Google sign-in) do not have a password. Making `passwordHash` nullable allows a user to exist with only an OAuth link. The login endpoint checks for this: if a user exists but has no password hash, the "invalid credentials" error is returned, directing them to use their OAuth provider instead.

---

## PostgreSQL Schema

### User

| Column | Type | Key/Constraint | Default |
|--------|------|----------------|---------|
| `id` | String | PK | `cuid()` |
| `email` | String | Unique | -- |
| `passwordHash` | String? | -- | -- |
| `name` | String | Unique | -- |
| `avatarUrl` | String? | -- | -- |
| `rating` | Int | Indexed | `1000` |
| `gamesPlayed` | Int | -- | `0` |
| `wins` | Int | -- | `0` |
| `losses` | Int | -- | `0` |
| `draws` | Int | -- | `0` |
| `createdAt` | DateTime | -- | `now()` |
| `updatedAt` | DateTime | -- | auto |

### Account (OAuth)

| Column | Type | Key/Constraint | Default |
|--------|------|----------------|---------|
| `id` | String | PK | `cuid()` |
| `userId` | String | FK -> User, Indexed | -- |
| `provider` | String | Unique with providerAccountId | -- |
| `providerAccountId` | String | Unique with provider | -- |

On delete: Cascade (deleted with user).

### RefreshToken

| Column | Type | Key/Constraint | Default |
|--------|------|----------------|---------|
| `id` | String | PK | `cuid()` |
| `token` | String | Unique | -- |
| `userId` | String | FK -> User, Indexed | -- |
| `expiresAt` | DateTime | -- | -- |
| `createdAt` | DateTime | -- | `now()` |

On delete: Cascade. Token column stores SHA-256 hash, not raw token.

### Game

| Column | Type | Key/Constraint | Default |
|--------|------|----------------|---------|
| `id` | String | PK | `cuid()` |
| `playerXId` | String | FK -> User, Indexed | -- |
| `playerOId` | String? | FK -> User, Indexed | -- |
| `winnerId` | String? | FK -> User | -- |
| `roomId` | String? | Indexed | -- |
| `status` | GameStatus | -- | `WAITING` |
| `startedAt` | DateTime | Indexed | `now()` |
| `endedAt` | DateTime? | -- | -- |

### Move

| Column | Type | Key/Constraint | Default |
|--------|------|----------------|---------|
| `id` | String | PK | `cuid()` |
| `gameId` | String | FK -> Game, Indexed | -- |
| `player` | PlayerMark | -- | -- |
| `position` | Int | -- | -- |
| `moveNum` | Int | Compound index [gameId, moveNum] | -- |
| `createdAt` | DateTime | -- | `now()` |

On delete: Cascade (deleted with game).

### Enums

**GameStatus:** `WAITING`, `IN_PROGRESS`, `X_WINS`, `O_WINS`, `DRAW`, `ABANDONED`

**PlayerMark:** `X`, `O`

---

## Redis Data Structures

| Key Pattern | Redis Type | TTL | Why This Type |
|-------------|-----------|-----|---------------|
| `room:{roomId}` | String (JSON) | 2 hours | Single atomic read/write for full room state |
| `rooms` | Set | -- | O(1) membership checks, O(N) listing -- perfect for "is room active?" + "list all rooms" |
| `user:room:{userId}` | String | 2 hours | Simple key-value lookup: "which room is this user in?" |
| `game:state:{roomId}` | String (JSON) | 2 hours | Same reasoning as room -- atomic read/write of full game state |
| `lobby:chat` | List | 24 hours | Ordered by insertion time, LPUSH + LTRIM keeps last 50 |
| `room:chat:{roomId}` | List | 24 hours | Same as lobby chat, scoped to room |
| `lobby:online` | Set | -- | O(1) add/remove, SCARD for count -- no duplicates |
| `chat:rate:{userId}` | String (counter) | 10 seconds | INCR is atomic, TTL auto-resets the window |

---

## Entity Relationship Diagram

```
User
  |-- 1:N --> Account (OAuth providers)
  |-- 1:N --> RefreshToken
  |-- 1:N --> Game (as playerX)
  |-- 1:N --> Game (as playerO)
  |-- 1:N --> Game (as winner)

Game
  |-- 1:N --> Move
```

**Key talking point:** The three separate Game relations on User (playerX, playerO, winner) allow efficient queries: "Show me all games where I played X", "Show me all my wins", etc. Prisma handles the relation naming to avoid ambiguity.

---

## At Scale

| Current | At Scale |
|---------|----------|
| Single PostgreSQL in Docker | **RDS Multi-AZ** with automated backups and point-in-time recovery |
| Single Redis in Docker | **Redis Cluster** (3+ shards) or **ElastiCache** for HA |
| All games in one table | **Partition the Game table by date** -- archive games older than 90 days to cold storage (S3 + Athena for analytics) |
| Stats on User model | **Materialized view or separate stats table** -- avoids row-level locks on User during concurrent game completions |
| No read replicas | **Read replicas** for leaderboard and stats queries, write to primary only |
| CUIDs for all IDs | Still fine -- but consider **ULIDs** if cross-system interop becomes important |
| No caching layer | **Redis cache** (or a separate cache cluster) for hot queries like leaderboard top 100 |

### Key Talking Point

The dual-storage pattern means I already have the right tool for each job. Scaling is about making each tool more resilient (managed services, replication, clustering), not about changing the fundamental data architecture.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | Database Schema | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
