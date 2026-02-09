import type { ClientToServerEvents, ServerToClientEvents } from "@ttt/shared";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../config/api";
import { useAuthStore } from "../stores/authStore";
import { getAccessToken } from "./auth";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return socket;
}

export function connectSocket(
  authProvider: () => Promise<Record<string, string | undefined>>,
): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    path: "/api/socket.io/",
    transports: ["websocket", "polling"],
    auth: (cb) => {
      authProvider().then((authData) => cb(authData));
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  }) as TypedSocket;

  socket.on("connect", () => {
    if (__DEV__) console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    if (__DEV__) console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    if (__DEV__) console.error("[Socket] Connection error:", err.message);
  });

  return socket;
}

export async function connectWithAuth(
  isGuest: boolean,
  guestId?: string,
  guestName?: string,
): Promise<TypedSocket> {
  const authProvider = async (): Promise<Record<string, string | undefined>> => {
    const state = useAuthStore.getState();
    if (state.isGuest && state.user) {
      return { guestId: state.user.id, guestName: state.user.name };
    }
    const token = await getAccessToken();
    if (!token) {
      throw new Error("No access token available");
    }
    return { token };
  };

  if (!isGuest) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("No access token available");
    }
  }

  return connectSocket(authProvider);
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
