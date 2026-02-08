// ─── Socket Event Names ────────────────────────────────

export const SOCKET_EVENTS = {
  GAME_MOVE: "game:move",
  GAME_STATE: "game:state",
  GAME_MOVED: "game:moved",
  GAME_OVER: "game:over",
  GAME_FORFEIT: "game:forfeit",
  GAME_REMATCH: "game:rematch",
  GAME_OPPONENT_DISCONNECTED: "game:opponent_disconnected",
  MATCHMAKING_JOIN: "matchmaking:join",
  MATCHMAKING_LEAVE: "matchmaking:leave",
  MATCHMAKING_FOUND: "matchmaking:found",
  MATCHMAKING_WAITING: "matchmaking:waiting",
  ERROR: "error",
} as const;

// ─── Game Config ───────────────────────────────────────

export const GAME_CONFIG = {
  DISCONNECT_TIMEOUT_SECONDS: 30,
  GAME_TTL_SECONDS: 3600, // 1 hour
  MAX_MATCHMAKING_WAIT_SECONDS: 60,
  INITIAL_RATING: 1000,
  RATING_K_FACTOR: 32,
  COUNTDOWN_SECONDS: 3,
} as const;

// ─── Room Config ──────────────────────────────────────

export const ROOM_CONFIG = {
  MAX_PLAYERS: 2,
  MAX_SPECTATORS: 8,
  MAX_TOTAL: 10,
  MAX_NAME_LENGTH: 30,
  ROOM_TTL_SECONDS: 7200, // 2 hours
  ROOM_CODE_LENGTH: 8,
} as const;

// ─── Chat Config ──────────────────────────────────────

export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 200,
  MESSAGE_TTL_SECONDS: 3600, // 1 hour
  MAX_HISTORY: 50,
  RATE_LIMIT_MESSAGES: 5,
  RATE_LIMIT_WINDOW_SECONDS: 10,
} as const;

// ─── Redis Key Prefixes ──────────────────────────────

export const REDIS_KEYS = {
  ROOM: "room:",
  ROOM_LIST: "rooms",
  ROOM_MEMBERS: "room:members:",
  ROOM_CHAT: "room:chat:",
  LOBBY_CHAT: "lobby:chat",
  LOBBY_ONLINE: "lobby:online",
  GAME_STATE: "game:state:",
  USER_ROOM: "user:room:",
  CHAT_RATE: "chat:rate:",
  PASSWORD_RESET: "password_reset:",
} as const;

// ─── Game Type Config ────────────────────────────────

import type { GameType, PlayerSide } from "./types";

export const GAME_TYPE_CONFIG: Record<
  GameType,
  { displayName: string; maxPlayers: number; defaultSide1: PlayerSide; defaultSide2: PlayerSide }
> = {
  tic_tac_toe: { displayName: "Tic-Tac-Toe", maxPlayers: 2, defaultSide1: "X", defaultSide2: "O" },
  chess: { displayName: "Chess", maxPlayers: 2, defaultSide1: "white", defaultSide2: "black" },
} as const;

export const CHESS_CONFIG = {
  INITIAL_FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  PIECE_SYMBOLS: {
    white: { k: "\u2654", q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658", p: "\u2659" },
    black: { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" },
  },
} as const;

// ─── API Routes ────────────────────────────────────────

export const API_ROUTES = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    REFRESH: "/api/auth/refresh",
    LOGOUT: "/api/auth/logout",
    GOOGLE: "/api/auth/google",
    GITHUB: "/api/auth/github",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
  },
  USER: {
    PROFILE: "/api/user/profile",
    STATS: "/api/user/stats",
    LEADERBOARD: "/api/user/leaderboard",
  },
  GAME: {
    HISTORY: "/api/game/history",
    DETAIL: "/api/game/:id",
  },
  HEALTH: "/api/health",
} as const;
