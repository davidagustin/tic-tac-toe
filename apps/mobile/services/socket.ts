import type { ClientToServerEvents, ServerToClientEvents } from "@ttt/shared";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../config/api";
import { getAccessToken } from "./auth";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return socket;
}

export function connectSocket(auth: {
  token?: string;
  guestId?: string;
  guestName?: string;
}): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    path: "/api/socket.io/",
    transports: ["websocket", "polling"],
    auth,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  }) as TypedSocket;

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });

  return socket;
}

export async function connectWithAuth(
  isGuest: boolean,
  guestId?: string,
  guestName?: string,
): Promise<TypedSocket> {
  if (isGuest && guestId && guestName) {
    return connectSocket({ guestId, guestName });
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("No access token available");
  }

  return connectSocket({ token });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
