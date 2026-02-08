import type { GameType } from "@prisma/client";
import type { GameType as SharedGameType } from "@ttt/shared";
import { GAME_CONFIG } from "@ttt/shared";
import { prisma } from "../lib/prisma";

// Map shared GameType string to Prisma enum
function toPrismaGameType(gameType: SharedGameType): GameType {
  return gameType === "tic_tac_toe" ? "TIC_TAC_TOE" : "CHESS";
}

function calculateElo(
  playerRating: number,
  opponentRating: number,
  actualScore: number, // 1 = win, 0 = loss, 0.5 = draw
): number {
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  return Math.round(playerRating + GAME_CONFIG.RATING_K_FACTOR * (actualScore - expected));
}

export async function getOrCreateRating(
  userId: string,
  gameType: SharedGameType,
): Promise<{ rating: number; gamesPlayed: number; wins: number; losses: number; draws: number }> {
  const prismaType = toPrismaGameType(gameType);

  const existing = await prisma.userRating.findUnique({
    where: { userId_gameType: { userId, gameType: prismaType } },
  });

  if (existing) {
    return {
      rating: existing.rating,
      gamesPlayed: existing.gamesPlayed,
      wins: existing.wins,
      losses: existing.losses,
      draws: existing.draws,
    };
  }

  // Create a default rating entry
  const created = await prisma.userRating.create({
    data: { userId, gameType: prismaType },
  });

  return {
    rating: created.rating,
    gamesPlayed: created.gamesPlayed,
    wins: created.wins,
    losses: created.losses,
    draws: created.draws,
  };
}

export async function getUserRatings(userId: string) {
  return prisma.userRating.findMany({
    where: { userId },
    select: {
      gameType: true,
      rating: true,
      gamesPlayed: true,
      wins: true,
      losses: true,
      draws: true,
    },
  });
}

export async function updateRatingsAfterGame(
  gameType: SharedGameType,
  player1Id: string,
  player2Id: string,
  winnerId: string | null, // null = draw
): Promise<void> {
  const prismaType = toPrismaGameType(gameType);

  const p1IsGuest = player1Id.startsWith("guest_");
  const p2IsGuest = player2Id.startsWith("guest_");

  // Get current ratings
  const p1Rating = p1IsGuest
    ? GAME_CONFIG.INITIAL_RATING
    : (await getOrCreateRating(player1Id, gameType)).rating;
  const p2Rating = p2IsGuest
    ? GAME_CONFIG.INITIAL_RATING
    : (await getOrCreateRating(player2Id, gameType)).rating;

  const p1Score = winnerId === player1Id ? 1 : winnerId === null ? 0.5 : 0;
  const p2Score = 1 - p1Score;

  const newP1Rating = calculateElo(p1Rating, p2Rating, p1Score);
  const newP2Rating = calculateElo(p2Rating, p1Rating, p2Score);

  const updates: Promise<unknown>[] = [];

  if (!p1IsGuest) {
    updates.push(
      prisma.userRating.upsert({
        where: { userId_gameType: { userId: player1Id, gameType: prismaType } },
        update: {
          rating: newP1Rating,
          gamesPlayed: { increment: 1 },
          ...(winnerId === player1Id
            ? { wins: { increment: 1 } }
            : winnerId === null
              ? { draws: { increment: 1 } }
              : { losses: { increment: 1 } }),
        },
        create: {
          userId: player1Id,
          gameType: prismaType,
          rating: newP1Rating,
          gamesPlayed: 1,
          ...(winnerId === player1Id
            ? { wins: 1 }
            : winnerId === null
              ? { draws: 1 }
              : { losses: 1 }),
        },
      }),
    );

    // Also update legacy User.rating for backwards compatibility (use the TTT rating)
    if (gameType === "tic_tac_toe") {
      updates.push(
        prisma.user.update({
          where: { id: player1Id },
          data: {
            rating: newP1Rating,
            gamesPlayed: { increment: 1 },
            ...(winnerId === player1Id
              ? { wins: { increment: 1 } }
              : winnerId === null
                ? { draws: { increment: 1 } }
                : { losses: { increment: 1 } }),
          },
        }),
      );
    }
  }

  if (!p2IsGuest) {
    updates.push(
      prisma.userRating.upsert({
        where: { userId_gameType: { userId: player2Id, gameType: prismaType } },
        update: {
          rating: newP2Rating,
          gamesPlayed: { increment: 1 },
          ...(winnerId === player2Id
            ? { wins: { increment: 1 } }
            : winnerId === null
              ? { draws: { increment: 1 } }
              : { losses: { increment: 1 } }),
        },
        create: {
          userId: player2Id,
          gameType: prismaType,
          rating: newP2Rating,
          gamesPlayed: 1,
          ...(winnerId === player2Id
            ? { wins: 1 }
            : winnerId === null
              ? { draws: 1 }
              : { losses: 1 }),
        },
      }),
    );

    if (gameType === "tic_tac_toe") {
      updates.push(
        prisma.user.update({
          where: { id: player2Id },
          data: {
            rating: newP2Rating,
            gamesPlayed: { increment: 1 },
            ...(winnerId === player2Id
              ? { wins: { increment: 1 } }
              : winnerId === null
                ? { draws: { increment: 1 } }
                : { losses: { increment: 1 } }),
          },
        }),
      );
    }
  }

  await Promise.all(updates);
}
