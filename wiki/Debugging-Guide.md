# Debugging Guide -- Interview Study Guide

This page documents how a real production bug was diagnosed and fixed. Use it to prepare for behavioral and technical debugging questions in interviews.

---

## Tell Me About a Bug You Debugged

**The Scenario:**

The room screen froze on "Loading room..." in production. Users could see the lobby, browse rooms, and click "Join Room," but after joining, the room screen would appear and stay stuck on a loading spinner indefinitely. The bug affected both creating a new room and joining an existing room.

**The Root Cause:**

A race condition between Socket.IO event emission and React component mount timing. There were actually two broken code paths:

1. **Create path**: When a user created a new room, the server added them to the Socket.IO room and returned a success callback, but never emitted the `room:state` event containing the room data. The creator never received any state.

2. **Join path**: When a user joined an existing room, the server emitted `room:state` immediately after they joined, but the client navigated to the room screen only after the callback returned. By the time the room screen mounted and registered its Socket.IO event listeners, the `room:state` event had already been sent and lost.

**The Fix:**

Two changes working together:

1. **Client** (mobile app): Register all Socket.IO event listeners first in the `useRoom` hook, then emit a `room:join` event to request the room state. This ensures the listener exists before the server sends the data.

2. **Server**: Detect when a user is rejoining a room they're already in (an `isRejoining` flag based on Redis state), and when rejoining, skip the password check, skip duplicate "player joined" notifications to other users, and skip unnecessary lobby updates. The server always responds to `room:join` with a fresh `room:state` event, whether it's the first join or a rejoin.

Together, these changes implement the "subscribe before request" pattern: the client asks for state only after it's ready to receive it, and the server always sends state when asked, treating rejoins as idempotent state-fetch operations.

---

## The Debugging Process (Step by Step)

This is the "follow the data backward" method I used to trace the bug from the user-visible symptom down to the root cause.

### Step 1: Identify the symptom

The room screen shows "Loading room..." indefinitely. Looking at the code in `app/(game)/room/[id].tsx` lines 51-57, that's the fallback UI when `room` is `null`:

```tsx
if (!room) {
  return (
    <SafeAreaView>
      <Text>Loading room...</Text>
    </SafeAreaView>
  );
}
```

So the issue is: `room` is stuck at `null`. That value comes from `useRoomStore.currentRoom` via the `useRoom` hook.

### Step 2: Trace the data source

The `currentRoom` state is set by calling `store.setRoom()`, which is triggered inside the `useRoom` hook by this listener:

```tsx
socket.on("room:state", (roomData) => {
  store.setRoom(roomData);
});
```

This means the `room:state` event was never received by the client.

### Step 3: Check the server emission

I checked the server-side code for both the create and join flows:

**Create path** (`handlers/room.ts`, `room:create` handler):
- Creates the room in Redis
- Joins the user to the Socket.IO room
- Returns a callback with `{ success: true, roomId }`
- **NEVER emits `room:state`** to the creator

**Join path** (`handlers/room.ts`, `room:join` handler at line 106):
- Emits `room:state` immediately after adding the user to Redis
- Then calls the callback `callback({ success: true })`
- The client receives the callback and navigates to the room screen
- **But the room screen hasn't mounted yet**, so the `room:state` listener doesn't exist

### Step 4: Confirm the race condition timeline

Here's the exact sequence of events for the join path:

```
Lobby Screen          Server              Room Screen
  │                     │                     │
  ├─ emit("room:join")─>│                     │
  │                     ├─ emit("room:state")─> (no listener!)
  │                     ├─ callback({success})>│
  ├─ router.push() ────────────────────────────>│
  │                     │              mounts, registers listener
  │                     │              ...waits forever
```

The server emits `room:state` before the client screen that needs to receive it even exists. By the time the listener is registered, the event is already lost.

### Step 5: Design the fix

The solution is to reverse the order on the client: register listeners first, then request state.

The client's `useRoom` hook already registers all Socket.IO listeners when it mounts. I added one more step at the end of the effect: emit `room:join` with the current `roomId` to ask the server for the room state. This reuses the existing `room:join` event — no new types needed in `@ttt/shared`.

On the server, I added an `isRejoining` flag that detects when a user is already in a room. When rejoining:
- Skip the password check (they already passed it the first time)
- Skip the `room:player_joined` broadcast (don't spam "X joined" twice)
- Skip the lobby update (no state change to broadcast)
- Still call `addMemberToRoom`, which is idempotent (just sets `isConnected = true` if the user already exists)

This makes `room:join` safely idempotent: the first call adds the user, subsequent calls just refresh state.

---

## The Fix (with code)

### Client fix (`hooks/useRoom.ts`)

After registering all Socket.IO event listeners in the `useEffect`, I added this at the end:

```tsx
useEffect(() => {
  // ... all socket.on(...) listeners registered here ...

  // Request room state now that we're ready to receive it
  if (roomId) {
    socket.emit("room:join", { roomId });
  }

  return () => {
    // ... cleanup ...
  };
}, [roomId]);
```

**Why this works:** The listener for `room:state` is registered before `room:join` is emitted, so the server's response will be received.

### Server fix (`handlers/room.ts`)

Added an `isRejoining` flag and used it to skip unnecessary operations:

```tsx
const existingRoom = await getUserCurrentRoom(socket.data.userId!);
const isRejoining = existingRoom === roomId;

// Skip password check if rejoining
if (!isRejoining) {
  if (room.password && room.password !== password) {
    return callback({ success: false, message: "Incorrect password" });
  }
}

// Add the user (idempotent if rejoining)
await addMemberToRoom(roomId, socket.data.userId!, socket.id);

// Skip notifications if rejoining
if (!isRejoining) {
  io.to(roomId).emit("room:player_joined", { userId: socket.data.userId! });
  broadcastLobbyUpdate(io);
}

// Always send room state
const roomData = await getRoomForClient(roomId);
socket.emit("room:state", roomData);
callback({ success: true });
```

**Why this works:** The server always sends `room:state` when asked, whether it's the first join or a rejoin. Rejoining is now safe and idempotent.

---

## Interview Q&A

### Q: "How did you identify it was a race condition?"

> By tracing the data backward: the screen shows null → the store was never updated → the event was never received → but the server DID emit the event → so the timing was wrong. The key insight was realizing the navigation (router.push) happens after the server's response, but before the new screen mounts. That gap is where the event gets lost.

### Q: "Why not just delay the navigation until the room screen is ready?"

> That would couple the lobby to the room screen's lifecycle. The cleaner fix is to make the room screen self-sufficient — it requests its own state on mount. This also handles direct URL navigation and reconnection scenarios. If a user bookmarks the room URL or refreshes the page, the screen can still fetch its state without depending on the lobby.

### Q: "Why reuse room:join instead of adding a new event like room:request_state?"

> Fewer moving parts. `room:join` already does exactly what we need — it sends back `room:state`. Adding a new event means updating the shared types package, adding a new server handler, and maintaining two code paths that do the same thing. The rejoin guard (`isRejoining` flag) makes `room:join` safely idempotent, so reusing it eliminates complexity.

### Q: "What about the security of skipping the password check?"

> The password check is only skipped when `isRejoining` is true — meaning Redis already has a user→room mapping for this user and this room. That mapping only exists because they previously passed the password check in the lobby. An unauthenticated user can't bypass the password because they have no Redis mapping. The password was verified when they first joined; rejoining just refreshes state.

### Q: "Could this race condition happen in other places?"

> Any time a Socket.IO event is emitted before the recipient has registered a listener. The pattern to prevent it: register listeners first, then emit the request. This is the "subscribe before request" pattern used in pub/sub systems. For example, if we add a spectator feature, the spectator screen should register its `game:update` listener before emitting `spectate:join`.

---

## Key Takeaways (for interview prep)

- **Debug by tracing data backward** from the symptom to the source — if the UI shows null, find where that value is set, then find where the setter is called, and so on until you reach the I/O boundary.
- **Race conditions in SPAs** happen when navigation separates the "request" from the "listener" — the component that needs the data doesn't exist when the data arrives.
- **Subscribe before request** — always register listeners before emitting the event that triggers the response. This is a fundamental rule in event-driven systems.
- **Idempotent operations** make rejoin/reconnect safe — `addMemberToRoom` handles duplicates gracefully (just updates `isConnected`), so calling it twice doesn't break anything.
- **Reuse existing events** when possible — fewer types, fewer handlers, fewer bugs. The `room:join` event already sent `room:state`, so we just made it idempotent instead of adding a new event.
- **The server is the authority** — the client requests state, the server decides what to send. The client never assumes it has the latest data; it always asks.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md) | [Build Guide](Build-Guide.md) | [Setup Guide](Setup-Guide.md) | Debugging Guide
