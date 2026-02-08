import type {
  GameOverPayload,
  GameType,
  MovedPayload,
  OnlineGameState,
  RoomDetail,
} from "@ttt/shared";

export interface MoveResult {
  success: boolean;
  error?: string;
  state?: OnlineGameState;
  gameOver?: boolean;
  movedPayload?: MovedPayload;
  gameOverPayload?: GameOverPayload;
}

export interface GameEngine {
  readonly gameType: GameType;
  createGameState(room: RoomDetail): OnlineGameState;
  processMove(state: OnlineGameState, userId: string, movePayload: unknown): MoveResult;
  processForfeit(state: OnlineGameState, userId: string): MoveResult;
  createRematchState(room: RoomDetail, previousState: OnlineGameState): OnlineGameState;
}
