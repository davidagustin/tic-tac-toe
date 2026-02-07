# Socket.IO Events Reference

Complete reference for all Socket.IO events in the Tic-Tac-Toe Online application. All events are fully typed via `ClientToServerEvents` and `ServerToClientEvents` in `@ttt/shared`.

## Connection

**Path:** `/api/socket.io/`

**Transports:** `websocket`, `polling`

**Authentication:** Passed via `handshake.auth`:

| Auth Type | Fields | Description |
|-----------|--------|-------------|
| JWT | `{ token: string }` | Authenticated user. Token verified server-side. |
| Guest | `{ guestId: string, guestName: string }` | Guest user. No database lookup. |

---

## Lobby Events

Events for the global lobby where players browse rooms and chat.

### Client to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:join` | _(none)_ | Join the lobby. Server responds with room list, chat history, and online count. |
| `lobby:leave` | _(none)_ | Leave the lobby. Decrements online count. |
| `lobby:chat` | `{ text: string }` | Send a chat message to the lobby. Rate limited: 5 messages per 10 seconds. Max 200 characters. |

### Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:rooms` | `RoomInfo[]` | Full list of active rooms. Sent on `lobby:join`. |
| `lobby:room_added` | `RoomInfo` | A new room was created. |
| `lobby:room_updated` | `RoomInfo` | A room's state changed (player joined, game started, etc.). |
| `lobby:room_removed` | `string` (roomId) | A room was deleted (empty or expired). |
| `lobby:chat` | `ChatMessage` | A new lobby chat message. |
| `lobby:chat_history` | `ChatMessage[]` | Initial chat history (up to 50 messages). Sent on `lobby:join`. |
| `lobby:online_count` | `number` | Updated count of online players. Broadcast when players join or leave. |

---

## Room Events

Events for individual game rooms.

### Client to Server

| Event | Payload | Callback | Description |
|-------|---------|----------|-------------|
| `room:create` | `{ name: string, password?: string }` | `(response: { success: boolean, roomId?: string, error?: string }) => void` | Create a new room. **Guests cannot create rooms.** Name max 30 characters. Password is optional. |
| `room:join` | `{ roomId: string, password?: string }` | `(response: { success: boolean, error?: string }) => void` | Join an existing room. Password required if room is protected. Joins as player (if slot open) or spectator. |
| `room:leave` | _(none)_ | -- | Leave the current room. Triggers host transfer if needed. |
| `room:ready` | _(none)_ | -- | Toggle ready status. When both players are ready, a 3-second countdown begins. |
| `room:kick` | `{ userId: string }` | -- | Kick a player from the room. **Host only, pre-game only.** |
| `room:chat` | `{ text: string }` | -- | Send a chat message to the room. Same rate limiting as lobby chat. |

### Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room:state` | `RoomDetail` | Full room state. Sent when joining a room. |
| `room:player_joined` | `RoomMember` | A player or spectator joined the room. |
| `room:player_left` | `{ userId: string, newHostId?: string }` | A member left. `newHostId` is set if host was transferred. |
| `room:player_ready` | `{ userId: string, isReady: boolean }` | A player toggled their ready status. |
| `room:countdown` | `number` (seconds) | Countdown tick. Values: 3, 2, 1. Emitted when both players are ready. |
| `room:kicked` | `{ reason: string }` | You were kicked from the room by the host. |
| `room:chat` | `ChatMessage` | A new room chat message. |
| `room:chat_history` | `ChatMessage[]` | Initial room chat history (up to 50 messages). Sent on room join. |

---

## Game Events

Events for active gameplay within a room.

### Client to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `game:move` | `{ position: number }` | Make a move. Position is 0-8 (top-left to bottom-right). Server validates turn order and cell availability. |
| `game:forfeit` | _(none)_ | Forfeit the current game. The forfeiting player loses. |
| `game:rematch` | _(none)_ | Request or accept a rematch. When both players send this, a new game starts with swapped marks. |

### Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | `OnlineGameState` | Full game state. Sent when a game starts. |
| `game:moved` | `{ position: number, player: Player, nextTurn: Player, board: Board }` | A move was applied. Contains the updated board and whose turn is next. |
| `game:over` | `{ winner: Player \| null, reason: string, finalBoard: Board, winningCells: number[] \| null }` | Game ended. `winner` is `null` for draws. `winningCells` contains the 3 winning indices or `null`. |
| `game:rematch_offered` | `{ userId: string }` | Your opponent wants a rematch. Send `game:rematch` to accept. |
| `game:rematch_start` | `OnlineGameState` | Both players agreed. New game state with swapped marks. |

---

## Error Events

| Event | Payload | Description |
|-------|---------|-------------|
| `error` | `{ message: string, code: string }` | Server-side error. Codes include `INVALID_MOVE`, `NOT_YOUR_TURN`, etc. |

---

## Type Definitions

### `RoomInfo`

```typescript
{
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  hasPassword: boolean;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;       // always 2
  maxSpectators: number;    // always 8
  status: "waiting" | "playing";
  createdAt: string;
}
```

### `RoomDetail`

```typescript
{
  id: string;
  name: string;
  hostId: string;
  hasPassword: boolean;
  status: "waiting" | "playing";
  players: RoomMember[];
  spectators: RoomMember[];
  createdAt: string;
  expiresAt: string;
}
```

### `RoomMember`

```typescript
{
  userId: string;
  name: string;
  rating: number;
  role: "player" | "spectator";
  isReady: boolean;
  isConnected: boolean;
  mark?: "X" | "O";         // only set for players
}
```

### `OnlineGameState`

```typescript
{
  roomId: string;
  board: (Player | null)[];  // length 9
  currentTurn: "X" | "O";
  status: "waiting" | "in_progress" | "x_wins" | "o_wins" | "draw" | "abandoned";
  playerX: RoomMember;
  playerO: RoomMember;
  moves: GameMove[];
  startedAt: string;
}
```

### `GameMove`

```typescript
{
  player: "X" | "O";
  position: number;          // 0-8
  moveNum: number;
  timestamp: string;
}
```

### `ChatMessage`

```typescript
{
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  channel: "lobby" | "room";
}
```

---

## Board Position Mapping

```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

---

## Rate Limiting

| Context | Limit | Window |
|---------|-------|--------|
| Chat (lobby + room) | 5 messages | 10 seconds |
| Message length | 200 characters max | -- |
| Chat history | 50 messages retained | 24-hour TTL |

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | Socket Events | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
