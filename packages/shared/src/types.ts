// ─── Core Game Types ───────────────────────────────────

export type Player = "X" | "O";
export type CellValue = Player | null;
export type Board = CellValue[]; // length 9, indices 0-8
export type GameStatus = "waiting" | "in_progress" | "x_wins" | "o_wins" | "draw" | "abandoned";

export interface GameState {
  id: string;
  board: Board;
  currentTurn: Player;
  status: GameStatus;
  playerX: PlayerInfo;
  playerO: PlayerInfo | null; // null while waiting for opponent
  moves: GameMove[];
  createdAt: string;
}

export interface GameMove {
  player: Player;
  position: number; // 0-8
  moveNum: number;
  timestamp: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  rating: number;
}

// ─── Auth Types ────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
  };
}

// ─── API Types ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Room & Multiplayer Types ─────────────────────────

export type RoomRole = "player" | "spectator";

export interface RoomMember {
  userId: string;
  name: string;
  rating: number;
  role: RoomRole;
  isReady: boolean;
  isConnected: boolean;
  mark?: Player; // only for players
}

export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  hasPassword: boolean;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  maxSpectators: number;
  status: "waiting" | "playing";
  createdAt: string;
}

export interface RoomDetail {
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

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  channel: "lobby" | "room";
}

export interface OnlineGameState {
  roomId: string;
  board: Board;
  currentTurn: Player;
  status: GameStatus;
  playerX: RoomMember;
  playerO: RoomMember;
  moves: GameMove[];
  startedAt: string;
}

// ─── Socket.IO Typed Event Maps ───────────────────────

export interface ClientToServerEvents {
  // Lobby
  "lobby:join": () => void;
  "lobby:leave": () => void;
  "lobby:chat": (data: { text: string }) => void;

  // Room
  "room:create": (
    data: { name: string; password?: string },
    callback: (response: { success: boolean; roomId?: string; error?: string }) => void,
  ) => void;
  "room:join": (
    data: { roomId: string; password?: string },
    callback: (response: { success: boolean; error?: string }) => void,
  ) => void;
  "room:leave": () => void;
  "room:ready": () => void;
  "room:kick": (data: { userId: string }) => void;
  "room:chat": (data: { text: string }) => void;

  // Game
  "game:move": (data: { position: number }) => void;
  "game:forfeit": () => void;
  "game:rematch": () => void;
}

export interface ServerToClientEvents {
  // Lobby
  "lobby:rooms": (rooms: RoomInfo[]) => void;
  "lobby:room_added": (room: RoomInfo) => void;
  "lobby:room_updated": (room: RoomInfo) => void;
  "lobby:room_removed": (roomId: string) => void;
  "lobby:chat": (message: ChatMessage) => void;
  "lobby:chat_history": (messages: ChatMessage[]) => void;
  "lobby:online_count": (count: number) => void;

  // Room
  "room:state": (room: RoomDetail) => void;
  "room:player_joined": (member: RoomMember) => void;
  "room:player_left": (data: { userId: string; newHostId?: string }) => void;
  "room:player_ready": (data: { userId: string; isReady: boolean }) => void;
  "room:chat": (message: ChatMessage) => void;
  "room:chat_history": (messages: ChatMessage[]) => void;
  "room:countdown": (seconds: number) => void;
  "room:kicked": (data: { reason: string }) => void;

  // Game
  "game:state": (state: OnlineGameState) => void;
  "game:moved": (data: {
    position: number;
    player: Player;
    nextTurn: Player;
    board: Board;
  }) => void;
  "game:over": (data: {
    winner: Player | null;
    reason: string;
    finalBoard: Board;
    winningCells: number[] | null;
  }) => void;
  "game:rematch_offered": (data: { userId: string }) => void;
  "game:rematch_start": (state: OnlineGameState) => void;

  // Errors
  error: (data: { message: string; code: string }) => void;
}
