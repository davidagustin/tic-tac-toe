import { useCallback, useEffect, useRef } from "react";
import { getSocket } from "../services/socket";
import { useAuthStore } from "../stores/authStore";
import { useOnlineGameStore } from "../stores/onlineGameStore";
import { useRoomStore } from "../stores/roomStore";

export function useRoom(roomId: string) {
  const { user } = useAuthStore();
  const store = useRoomStore();
  const gameStore = useOnlineGameStore();
  const registeredRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: store functions are stable
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user || registeredRef.current) return;

    registeredRef.current = true;

    socket.on("room:state", (room) => {
      store.setRoom(room);
      // Determine my role
      const me = [...room.players, ...room.spectators].find((m) => m.userId === user.id);
      store.setMyRole(me?.role ?? null);
    });

    socket.on("room:player_joined", (member) => {
      store.addMember(member);
    });

    socket.on("room:player_left", ({ userId, newHostId }) => {
      store.removeMember(userId, newHostId);
    });

    socket.on("room:player_ready", ({ userId, isReady }) => {
      store.setPlayerReady(userId, isReady);
    });

    socket.on("room:chat", (message) => {
      store.addChatMessage(message);
    });

    socket.on("room:chat_history", (messages) => {
      store.setChatHistory(messages);
    });

    socket.on("room:countdown", (seconds) => {
      store.setCountdown(seconds);
    });

    // Game events
    socket.on("game:state", (state) => {
      gameStore.setGameState(state, user.id);
      store.setCountdown(null);
    });

    socket.on("game:moved", ({ position, player, nextTurn, board }) => {
      gameStore.applyMove(position, player, nextTurn, board);
    });

    socket.on("game:over", ({ winner, finalBoard, winningCells }) => {
      gameStore.setGameOver(winner, finalBoard, winningCells);
    });

    socket.on("game:rematch_offered", ({ userId }) => {
      gameStore.setRematchOffered(userId);
    });

    socket.on("game:rematch_start", (state) => {
      gameStore.setGameState(state, user.id);
    });

    // Request room state from server — handles both initial mount
    // (where the earlier room:state event was missed) and reconnects
    socket.emit("room:join", { roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        console.error("[useRoom] Join/rejoin failed:", res.error);
      }
    });

    return () => {
      socket.off("room:state");
      socket.off("room:player_joined");
      socket.off("room:player_left");
      socket.off("room:player_ready");
      socket.off("room:chat");
      socket.off("room:chat_history");
      socket.off("room:countdown");
      socket.off("game:state");
      socket.off("game:moved");
      socket.off("game:over");
      socket.off("game:rematch_offered");
      socket.off("game:rematch_start");
      registeredRef.current = false;
      store.reset();
      gameStore.reset();
    };
  }, [roomId, user?.id]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket?.emit("room:leave");
    store.reset();
    gameStore.reset();
  }, []);

  const toggleReady = useCallback(() => {
    const socket = getSocket();
    socket?.emit("room:ready");
  }, []);

  const kickPlayer = useCallback((userId: string) => {
    const socket = getSocket();
    socket?.emit("room:kick", { userId });
  }, []);

  const sendChat = useCallback((text: string) => {
    const socket = getSocket();
    socket?.emit("room:chat", { text });
  }, []);

  const makeMove = useCallback((position: number) => {
    const socket = getSocket();
    socket?.emit("game:move", { position });
  }, []);

  const forfeit = useCallback(() => {
    const socket = getSocket();
    socket?.emit("game:forfeit");
  }, []);

  const offerRematch = useCallback(() => {
    const socket = getSocket();
    socket?.emit("game:rematch");
    gameStore.setIOfferedRematch(true);
  }, []);

  return {
    room: useRoomStore((s) => s.currentRoom),
    chatMessages: useRoomStore((s) => s.chatMessages),
    myRole: useRoomStore((s) => s.myRole),
    countdown: useRoomStore((s) => s.countdown),
    gameState: useOnlineGameStore((s) => s.gameState),
    myMark: useOnlineGameStore((s) => s.myMark),
    isMyTurn: useOnlineGameStore((s) => s.isMyTurn),
    winningCells: useOnlineGameStore((s) => s.winningCells),
    rematchOfferedBy: useOnlineGameStore((s) => s.rematchOfferedBy),
    iOfferedRematch: useOnlineGameStore((s) => s.iOfferedRematch),
    leaveRoom,
    toggleReady,
    kickPlayer,
    sendChat,
    makeMove,
    forfeit,
    offerRematch,
  };
}
