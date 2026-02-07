# Socket Events -- Interview Study Guide

---

## "How Does Your Real-Time System Work?"

This is the answer to give when an interviewer asks about your real-time architecture.

When the mobile app authenticates (login, register, or guest mode), it creates a **Socket.IO** connection to the Fastify server at path `/api/socket.io/`. The connection handshake includes either a JWT token or guest credentials. Server-side **middleware** runs before the connection is accepted -- it verifies the JWT (or validates the guest ID format), loads the user's name and rating, and attaches this data to the socket object. If authentication fails, the connection is rejected before any events can be exchanged.

Once connected, the client joins the **lobby** by emitting `lobby:join`. The server adds them to the `lobby` Socket.IO room, sends the current room list and chat history, and broadcasts an updated online count to all lobby members. Every lobby event -- room created, room updated, room deleted, chat message -- is broadcast to this room in real-time. The client's Zustand `lobbyStore` subscribes to these events and updates the UI reactively.

When a player creates or joins a game room, they leave the lobby room and enter a room-specific Socket.IO room (e.g., `room:aB3dEf9x`). All room and game events are scoped to this room, so players in other rooms never receive irrelevant traffic. During gameplay, moves are sent as `game:move` events with just a position (0-8). The server validates the move using the same `@ttt/shared` game logic, applies it, and broadcasts the updated board to the room. This round-trip typically completes in **under 100ms**.

For **multi-instance scaling**, the server uses Socket.IO's **Redis adapter**. All events pass through Redis pub/sub, so a player connected to server instance A receives events emitted by server instance B. This is already configured and working -- scaling horizontally is a deployment change, not a code change.

---

## Interview Q&A

### Q: "What happens when a player disconnects mid-game?"

Socket.IO uses a **ping/pong heartbeat** (25-second interval, 20-second timeout). When a client stops responding, the server fires a `disconnect` event after ~45 seconds. Here is what happens:

1. The player's `isConnected` flag is set to `false` in the Redis room state.
2. A `room:player_left` event is broadcast to remaining members with the disconnected player's ID.
3. If the disconnected player was the **host**, host role transfers to the next player. If no players remain, the first spectator is promoted.
4. If the player **reconnects** within the window, their user-to-room mapping in Redis (`user:room:{userId}`) still exists. They rejoin the room and receive the current state.
5. If the room empties completely, it is deleted from Redis and removed from the lobby room list.

**Key talking point:** The reconnection is seamless because all state is in Redis, not in server memory. Even if the client reconnects to a different server instance, the state is the same.

---

### Q: "How do you prevent cheating?"

The server is the **single source of truth**. Here is what happens on every `game:move` event:

1. Load the game state from Redis.
2. Verify the game status is `in_progress` (not already over).
3. Verify it is the requesting player's turn (check `currentTurn` against the socket's user ID and assigned mark).
4. Validate the cell is empty via `isValidMove(board, position)` from `@ttt/shared`.
5. Apply the move via `applyMove()`, check for winner/draw.
6. Save updated state to Redis, broadcast result to room.

If **any** check fails, the server emits an `error` event back to the client with a specific code (`INVALID_MOVE`, `NOT_YOUR_TURN`, etc.) and the move is **not applied**. The client-side game logic is only for instant UI feedback -- the player sees their move immediately, but it is not confirmed until the server broadcasts `game:moved`.

**Why this matters:** The client is untrusted. Anyone could modify the app, intercept socket events, or send crafted payloads. Server validation is non-negotiable for any multiplayer game.

---

### Q: "How would you handle scaling to multiple server instances?"

This is already handled by the **Socket.IO Redis adapter**. Here is how it works:

1. When server instance A emits an event to a room, the adapter publishes it to a Redis pub/sub channel.
2. Server instance B, which is subscribed to the same channel, receives the event and delivers it to any clients connected to B that are in that room.
3. This means a player on instance A and their opponent on instance B both receive the same events.

The one requirement is **sticky sessions** on the load balancer. Socket.IO's initial connection uses HTTP long-polling before upgrading to WebSocket. The polling requests must hit the same server instance to complete the upgrade. An **ALB with cookie-based stickiness** or **Nginx with ip_hash** solves this.

---

### Q: "How does your chat rate limiting work?"

I use a **sliding window counter** in Redis:

1. On each chat message, the server runs `INCR` on `chat:rate:{userId}` and sets a **10-second TTL** on first increment.
2. If the counter exceeds **5**, the message is rejected with a rate limit error.
3. The key auto-expires after 10 seconds, resetting the window.

This is simple, effective, and stateless from the server's perspective -- Redis handles the timing. The trade-off is it is not a true sliding window (it is a fixed window that resets on first message), but for chat it is more than sufficient.

**At scale:** I would add rate limiting to **all** Socket.IO events, not just chat. Moves, room joins, and reconnects should all have per-user rate limits to prevent abuse.

---

### Q: "Why typed events? What does that give you?"

All Socket.IO events are defined as TypeScript interfaces (`ClientToServerEvents` and `ServerToClientEvents`) in `@ttt/shared`. Both the server and mobile client import these types. This means:

- **Compile-time safety**: If I rename an event or change a payload shape, TypeScript catches every call site that needs updating.
- **No client/server disagreement**: The typed contract ensures both sides agree on event names and payload shapes.
- **Self-documenting**: The types serve as the event API documentation.

The trade-off is that runtime validation is still needed on the server (a malicious client can send anything). The types prevent accidental mistakes; Zod schemas prevent intentional ones.

---

### Q: "What is your reconnection strategy?"

The client is configured for automatic reconnection:

| Parameter | Value | Why |
|-----------|-------|-----|
| Max attempts | 10 | Prevents infinite retry loops on permanent failures |
| Initial delay | 1 second | Fast first retry for transient disconnects |
| Max delay | 5 seconds | Caps backoff to keep reconnection responsive |
| Backoff | Exponential | Avoids thundering herd when many clients reconnect simultaneously |

On reconnect, the client re-authenticates (token is in memory/secure storage) and re-joins its previous lobby or room. The server rebuilds the socket's state from Redis.

---

## Event Reference

### Connection Flow

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Client sends | _(handshake)_ | `{ token }` or `{ guestId, guestName }` | Authenticate on connect |
| Server sends | `error` | `{ message, code }` | Auth failure or runtime error |

### Lobby Flow

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Client sends | `lobby:join` | _(none)_ | Enter lobby, receive state |
| Client sends | `lobby:leave` | _(none)_ | Exit lobby |
| Client sends | `lobby:chat` | `{ text }` | Send lobby message (rate limited) |
| Server sends | `lobby:rooms` | `RoomInfo[]` | Full room list on join |
| Server sends | `lobby:room_added` | `RoomInfo` | New room created |
| Server sends | `lobby:room_updated` | `RoomInfo` | Room state changed |
| Server sends | `lobby:room_removed` | `string` | Room deleted |
| Server sends | `lobby:chat` | `ChatMessage` | New lobby message |
| Server sends | `lobby:chat_history` | `ChatMessage[]` | Last 50 messages on join |
| Server sends | `lobby:online_count` | `number` | Updated online count |

### Room Flow

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Client sends | `room:create` | `{ name, password? }` | Create room (callback with roomId) |
| Client sends | `room:join` | `{ roomId, password? }` | Join room (callback with success) |
| Client sends | `room:leave` | _(none)_ | Leave room |
| Client sends | `room:ready` | _(none)_ | Toggle ready status |
| Client sends | `room:kick` | `{ userId }` | Kick member (host only, pre-game) |
| Client sends | `room:chat` | `{ text }` | Send room message |
| Server sends | `room:state` | `RoomDetail` | Full room state on join |
| Server sends | `room:player_joined` | `RoomMember` | Member joined |
| Server sends | `room:player_left` | `{ userId, newHostId? }` | Member left, optional host transfer |
| Server sends | `room:player_ready` | `{ userId, isReady }` | Ready status changed |
| Server sends | `room:countdown` | `number` | Countdown tick (3, 2, 1) |
| Server sends | `room:kicked` | `{ reason }` | You were kicked |

### Game Flow

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Client sends | `game:move` | `{ position }` | Make move (0-8) |
| Client sends | `game:forfeit` | _(none)_ | Forfeit current game |
| Client sends | `game:rematch` | _(none)_ | Request/accept rematch |
| Server sends | `game:state` | `OnlineGameState` | Full game state on start |
| Server sends | `game:moved` | `{ position, player, nextTurn, board }` | Move applied |
| Server sends | `game:over` | `{ winner, reason, finalBoard, winningCells }` | Game ended |
| Server sends | `game:rematch_offered` | `{ userId }` | Opponent wants rematch |
| Server sends | `game:rematch_start` | `OnlineGameState` | Rematch starting, marks swapped |

---

## Type Definitions

These types are exported from `@ttt/shared` and used by both client and server. This is the **typed contract** that prevents client/server disagreement. If a payload shape changes in the shared package, both sides get compile errors until updated.

```typescript
// RoomInfo - what the lobby sees
{ id, name, hostId, hostName, hasPassword, playerCount,
  spectatorCount, maxPlayers, maxSpectators, status, createdAt }

// RoomDetail - what room members see
{ id, name, hostId, hasPassword, status,
  players: RoomMember[], spectators: RoomMember[], createdAt, expiresAt }

// RoomMember
{ userId, name, rating, role, isReady, isConnected, mark? }

// OnlineGameState
{ roomId, board: (Player | null)[9], currentTurn, status,
  playerX: RoomMember, playerO: RoomMember, moves: GameMove[], startedAt }

// GameMove
{ player, position, moveNum, timestamp }

// ChatMessage
{ id, userId, userName, text, timestamp, channel }
```

---

## Key Talking Points Summary

- **Auth before connection**: Socket middleware validates JWT/guest before any events fire.
- **Rooms scope events**: Players only receive events for their room, not all traffic.
- **Server is authority**: Client logic is for UX; server logic is for correctness.
- **Typed contract**: Shared TypeScript interfaces prevent client/server event disagreement.
- **Redis adapter**: Multi-instance ready without code changes.
- **Reconnection is seamless**: State is in Redis, not server memory.
- **Rate limiting in Redis**: Simple, stateless, auto-expiring counters.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | Socket Events | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md)
