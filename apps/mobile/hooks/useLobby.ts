import { useCallback, useEffect, useRef } from "react";
import { connectWithAuth, getSocket } from "../services/socket";
import { useAuthStore } from "../stores/authStore";
import { useLobbyStore } from "../stores/lobbyStore";

export function useLobby() {
  const { user, isGuest } = useAuthStore();
  const store = useLobbyStore();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!user || connectedRef.current) return;

    let mounted = true;

    async function connect() {
      try {
        const socket = await connectWithAuth(isGuest, user?.id, user?.name);

        if (!mounted) return;

        socket.on("connect", () => {
          store.setConnected(true);
          socket.emit("lobby:join");
        });

        socket.on("disconnect", () => {
          store.setConnected(false);
        });

        socket.on("lobby:rooms", (rooms) => {
          store.setRooms(rooms);
        });

        socket.on("lobby:room_added", (room) => {
          store.addRoom(room);
        });

        socket.on("lobby:room_updated", (room) => {
          store.updateRoom(room);
        });

        socket.on("lobby:room_removed", (roomId) => {
          store.removeRoom(roomId);
        });

        socket.on("lobby:chat", (message) => {
          store.addChatMessage(message);
        });

        socket.on("lobby:chat_history", (messages) => {
          store.setChatHistory(messages);
        });

        socket.on("lobby:online_count", (count) => {
          store.setOnlineCount(count);
        });

        // If already connected, join lobby immediately
        if (socket.connected) {
          store.setConnected(true);
          socket.emit("lobby:join");
        }

        connectedRef.current = true;
      } catch (err) {
        if (__DEV__) console.error("[useLobby] Connection failed:", err);
      }
    }

    connect();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit("lobby:leave");
        socket.off("lobby:rooms");
        socket.off("lobby:room_added");
        socket.off("lobby:room_updated");
        socket.off("lobby:room_removed");
        socket.off("lobby:chat");
        socket.off("lobby:chat_history");
        socket.off("lobby:online_count");
      }
      connectedRef.current = false;
      store.reset();
    };
  }, [user]);

  const sendChat = useCallback((text: string) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("lobby:chat", { text });
    }
  }, []);

  const createRoom = useCallback(
    (
      name: string,
      password?: string,
      gameType?: string,
    ): Promise<{ success: boolean; roomId?: string; error?: string }> => {
      return new Promise((resolve) => {
        const socket = getSocket();
        if (!socket?.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit("room:create", { name, password, gameType: gameType as any }, resolve);
      });
    },
    [],
  );

  const joinRoom = useCallback(
    (roomId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const socket = getSocket();
        if (!socket?.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit("room:join", { roomId, password }, resolve);
      });
    },
    [],
  );

  return {
    rooms: useLobbyStore((s) => s.rooms),
    chatMessages: useLobbyStore((s) => s.chatMessages),
    onlineCount: useLobbyStore((s) => s.onlineCount),
    isConnected: useLobbyStore((s) => s.isConnected),
    sendChat,
    createRoom,
    joinRoom,
  };
}
