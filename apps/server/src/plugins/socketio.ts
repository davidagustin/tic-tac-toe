import { createAdapter } from "@socket.io/redis-adapter";
import type { ClientToServerEvents, ServerToClientEvents } from "@ttt/shared";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server } from "socket.io";
import { registerGameHandlers } from "../handlers/game";
import { registerLobbyHandlers } from "../handlers/lobby";
import { registerRoomHandlers } from "../handlers/room";
import { config } from "../lib/config";
import { createRedisPub, createRedisSub } from "../lib/redis";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

declare module "fastify" {
  interface FastifyInstance {
    io: TypedServer;
  }
}

async function socketioPlugin(app: FastifyInstance) {
  const io: TypedServer = new Server(app.server, {
    path: "/api/socket.io/",
    cors: {
      origin: config.NODE_ENV === "development" ? true : ["https://game-practice-aws.com"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Redis adapter for multi-instance scaling
  const pubClient = createRedisPub();
  const subClient = createRedisSub();
  io.adapter(createAdapter(pubClient, subClient));

  // Auth middleware — verify JWT or accept guest tokens
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const guestId = socket.handshake.auth.guestId as string | undefined;
    const guestName = socket.handshake.auth.guestName as string | undefined;

    if (guestId && guestName) {
      // Guest connection
      socket.data.userId = guestId;
      socket.data.userName = guestName;
      socket.data.isGuest = true;
      socket.data.rating = 1000;
      return next();
    }

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = app.jwt.verify<{ userId: string; email: string }>(token);
      socket.data.userId = decoded.userId;
      socket.data.isGuest = false;
      // We'll look up the user name from DB on connect
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    // For authenticated users, load their name from DB
    if (!socket.data.isGuest && !socket.data.userName) {
      try {
        const { prisma } = await import("../lib/prisma");
        const user = await prisma.user.findUnique({
          where: { id: socket.data.userId },
          select: { name: true, rating: true },
        });
        if (user) {
          socket.data.userName = user.name;
          socket.data.rating = user.rating;
        } else {
          socket.disconnect(true);
          return;
        }
      } catch {
        socket.disconnect(true);
        return;
      }
    }

    app.log.info(`[Socket] ${socket.data.userName} connected (${socket.data.userId})`);

    // Register event handlers
    registerLobbyHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on("disconnect", () => {
      app.log.info(`[Socket] ${socket.data.userName} disconnected`);
    });
  });

  app.decorate("io", io);

  app.addHook("onClose", async () => {
    io.close();
    await pubClient.quit();
    await subClient.quit();
  });
}

export default fp(socketioPlugin, {
  name: "socketio",
  fastify: "5.x",
});
