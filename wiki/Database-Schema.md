# Database Schema

The application uses a dual-storage approach: **PostgreSQL** (via Prisma) for persistent data and **Redis** for ephemeral real-time state.

---

## PostgreSQL Models (Prisma)

Schema file: `apps/server/prisma/schema.prisma`

### User

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `String` | `@id` | `cuid()` | Unique identifier |
| `email` | `String` | `@unique` | -- | User email address |
| `passwordHash` | `String?` | -- | -- | bcrypt hash. `null` for OAuth-only users |
| `name` | `String` | `@unique` | -- | Display name / screen name |
| `avatarUrl` | `String?` | -- | -- | Profile picture URL |
| `rating` | `Int` | -- | `1000` | ELO-like rating |
| `gamesPlayed` | `Int` | -- | `0` | Total games completed |
| `wins` | `Int` | -- | `0` | Total wins |
| `losses` | `Int` | -- | `0` | Total losses |
| `draws` | `Int` | -- | `0` | Total draws |
| `createdAt` | `DateTime` | -- | `now()` | Account creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | -- | Last update timestamp |

**Indexes:** `rating`

**Relations:**
- `accounts` -> `Account[]` (OAuth providers)
- `gamesAsX` -> `Game[]` (games played as X)
- `gamesAsO` -> `Game[]` (games played as O)
- `wonGames` -> `Game[]` (games won)
- `refreshTokens` -> `RefreshToken[]`

---

### Account

Stores OAuth provider links for a user.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `String` | `@id` | `cuid()` | Unique identifier |
| `userId` | `String` | `FK -> User.id` | -- | Owning user |
| `provider` | `String` | -- | -- | OAuth provider (`"google"`, `"github"`) |
| `providerAccountId` | `String` | -- | -- | Provider-specific user ID |

**Unique:** `[provider, providerAccountId]`

**Indexes:** `userId`

**On Delete:** Cascade (deleted when user is deleted)

---

### RefreshToken

Stores hashed refresh tokens for JWT rotation.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `String` | `@id` | `cuid()` | Unique identifier |
| `token` | `String` | `@unique` | -- | SHA-256 hash of the actual token |
| `userId` | `String` | `FK -> User.id` | -- | Token owner |
| `expiresAt` | `DateTime` | -- | -- | Expiration timestamp (7 days from creation) |
| `createdAt` | `DateTime` | -- | `now()` | Creation timestamp |

**Indexes:** `userId`

**On Delete:** Cascade (deleted when user is deleted)

**Token Flow:**
1. Server generates 64-byte random token, hashes with SHA-256, stores hash in DB
2. Raw token sent to client (in response body + httpOnly cookie)
3. On refresh, client sends raw token; server hashes and looks up
4. Old token is revoked (deleted), new token created (rotation)

---

### Game

Records completed games for history and stats.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `String` | `@id` | `cuid()` | Unique identifier |
| `playerXId` | `String` | `FK -> User.id` | -- | Player X user ID |
| `playerOId` | `String?` | `FK -> User.id` | -- | Player O user ID. `null` until opponent joins. |
| `winnerId` | `String?` | `FK -> User.id` | -- | Winner user ID. `null` for draws. |
| `roomId` | `String?` | -- | -- | Socket.IO room ID for tracing |
| `status` | `GameStatus` | -- | `WAITING` | Game result |
| `startedAt` | `DateTime` | -- | `now()` | Game start timestamp |
| `endedAt` | `DateTime?` | -- | -- | Game end timestamp |

**Indexes:** `playerXId`, `playerOId`, `startedAt`, `roomId`

**Relations:**
- `playerX` -> `User` (relation "PlayerX")
- `playerO` -> `User?` (relation "PlayerO")
- `winner` -> `User?` (relation "Winner")
- `moves` -> `Move[]`

**Note:** Guest-only games (both players are guests) are NOT persisted to the database.

---

### Move

Records individual moves within a game.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `String` | `@id` | `cuid()` | Unique identifier |
| `gameId` | `String` | `FK -> Game.id` | -- | Parent game |
| `player` | `PlayerMark` | -- | -- | `X` or `O` |
| `position` | `Int` | -- | -- | Board position (0-8) |
| `moveNum` | `Int` | -- | -- | Sequential move number |
| `createdAt` | `DateTime` | -- | `now()` | Move timestamp |

**Indexes:** `gameId`, `[gameId, moveNum]`

**On Delete:** Cascade (deleted when game is deleted)

---

### Enums

#### GameStatus

| Value | DB Mapping | Description |
|-------|-----------|-------------|
| `WAITING` | `waiting` | Waiting for opponent |
| `IN_PROGRESS` | `in_progress` | Game actively being played |
| `X_WINS` | `x_wins` | Player X won |
| `O_WINS` | `o_wins` | Player O won |
| `DRAW` | `draw` | Game ended in draw |
| `ABANDONED` | `abandoned` | Game abandoned (disconnect, etc.) |

#### PlayerMark

| Value | Description |
|-------|-------------|
| `X` | Player X |
| `O` | Player O |

---

## Redis Data Structures

Redis key prefixes are defined in `packages/shared/src/constants.ts` as `REDIS_KEYS`.

### Room Data

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `room:{roomId}` | String (JSON) | 2 hours | `RoomDetail` + `passwordHash` (bcrypt hash of room password, if set) |
| `rooms` | Set | -- | Set of active room IDs |
| `user:room:{userId}` | String | 2 hours | Room ID the user is currently in |

**Room JSON structure:**
```json
{
  "id": "aB3dEf9x",
  "name": "My Room",
  "hostId": "clx...",
  "hasPassword": false,
  "status": "waiting",
  "players": [
    {
      "userId": "clx...",
      "name": "Alice",
      "rating": 1200,
      "role": "player",
      "isReady": false,
      "isConnected": true,
      "mark": "X"
    }
  ],
  "spectators": [],
  "createdAt": "2025-01-15T10:00:00.000Z",
  "expiresAt": "2025-01-15T12:00:00.000Z",
  "passwordHash": null
}
```

### Game State

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `game:state:{roomId}` | String (JSON) | 2 hours | `OnlineGameState` (board, turns, players, moves) |

### Chat

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `lobby:chat` | List | 24 hours | JSON-serialized `ChatMessage` objects. Trimmed to last 50. |
| `room:chat:{roomId}` | List | 24 hours | JSON-serialized `ChatMessage` objects. Trimmed to last 50. |

### Presence

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `lobby:online` | Set | -- | User IDs of players currently in the lobby |

### Rate Limiting

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `chat:rate:{userId}` | String (counter) | 10 seconds | Number of messages sent in current window. Limit: 5. |

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

Account
  |-- N:1 --> User

RefreshToken
  |-- N:1 --> User

Move
  |-- N:1 --> Game
```

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | Database Schema | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
