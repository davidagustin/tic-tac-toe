/**
 * Data migration: Copy existing User.{rating, gamesPlayed, wins, losses, draws}
 * into UserRating rows with gameType = TIC_TAC_TOE.
 *
 * Run after the schema migration: `npx tsx prisma/migrate-ratings.ts`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting rating migration...");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      rating: true,
      gamesPlayed: true,
      wins: true,
      losses: true,
      draws: true,
    },
  });

  console.log(`Found ${users.length} users to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    // Only migrate users who have played at least one game
    if (user.gamesPlayed === 0 && user.rating === 1000) {
      skipped++;
      continue;
    }

    await prisma.userRating.upsert({
      where: {
        userId_gameType: {
          userId: user.id,
          gameType: "TIC_TAC_TOE",
        },
      },
      update: {
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
      create: {
        userId: user.id,
        gameType: "TIC_TAC_TOE",
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
    migrated++;
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped (default stats)`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
