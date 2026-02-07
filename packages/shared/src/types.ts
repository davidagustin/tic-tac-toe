// ─── Core Game Types ───────────────────────────────────

export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type Board = CellValue[];       // length 9, indices 0-8
export type GameStatus = 'waiting' | 'in_progress' | 'x_wins' | 'o_wins' | 'draw' | 'abandoned';

export interface GameState {
  id: string;
  board: Board;
  currentTurn: Player;
  status: GameStatus;
  playerX: PlayerInfo;
  playerO: PlayerInfo | null;  // null while waiting for opponent
  moves: GameMove[];
  createdAt: string;
}

export interface GameMove {
  player: Player;
  position: number;           // 0-8
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

// ─── WebSocket Event Types ─────────────────────────────

export interface WsEvents {
  // Client → Server
  'game:move': { gameId: string; position: number };
  'game:forfeit': { gameId: string };
  'game:rematch': { gameId: string };
  'matchmaking:join': {};
  'matchmaking:leave': {};

  // Server → Client
  'game:state': GameState;
  'game:moved': { position: number; player: Player; nextTurn: Player };
  'game:over': { winner: Player | null; reason: string; finalBoard: Board };
  'game:opponent_disconnected': { timeoutSeconds: number };
  'matchmaking:found': { gameId: string; opponent: PlayerInfo };
  'matchmaking:waiting': { position: number; estimatedWait: number };
  'error': { message: string; code: string };
}
