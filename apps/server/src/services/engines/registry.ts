import type { GameType } from "@ttt/shared";
import type { GameEngine } from "./types";

const engines = new Map<GameType, GameEngine>();

export function registerEngine(engine: GameEngine): void {
  engines.set(engine.gameType, engine);
}

export function getEngine(gameType: GameType): GameEngine {
  const engine = engines.get(gameType);
  if (!engine) {
    throw new Error(`No engine registered for game type: ${gameType}`);
  }
  return engine;
}
