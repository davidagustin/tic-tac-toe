export type AiDifficulty = "easy" | "medium" | "hard";

export interface AiMoveResult {
  position: number;
}

export interface ChessAiMoveResult {
  from: string;
  to: string;
  promotion?: string;
}
