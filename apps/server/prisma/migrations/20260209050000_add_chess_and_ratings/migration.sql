-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('tic_tac_toe', 'chess');

-- AlterEnum: add chess values to GameStatus
ALTER TYPE "GameStatus" ADD VALUE 'white_wins';
ALTER TYPE "GameStatus" ADD VALUE 'black_wins';

-- AlterEnum: add chess values to PlayerMark
ALTER TYPE "PlayerMark" ADD VALUE 'WHITE';
ALTER TYPE "PlayerMark" ADD VALUE 'BLACK';

-- AlterTable: Game — add gameType, roomId; make playerOId optional
ALTER TABLE "Game" ADD COLUMN "gameType" "GameType" NOT NULL DEFAULT 'tic_tac_toe';
ALTER TABLE "Game" ADD COLUMN "roomId" TEXT;
ALTER TABLE "Game" ALTER COLUMN "playerOId" DROP NOT NULL;

-- AlterTable: Move — make position optional, add chess fields
ALTER TABLE "Move" ALTER COLUMN "position" DROP NOT NULL;
ALTER TABLE "Move" ADD COLUMN "fromSquare" TEXT;
ALTER TABLE "Move" ADD COLUMN "toSquare" TEXT;
ALTER TABLE "Move" ADD COLUMN "san" TEXT;
ALTER TABLE "Move" ADD COLUMN "promotion" TEXT;

-- CreateTable
CREATE TABLE "UserRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");

-- CreateIndex
CREATE INDEX "Game_gameType_idx" ON "Game"("gameType");

-- CreateIndex
CREATE INDEX "UserRating_userId_idx" ON "UserRating"("userId");

-- CreateIndex
CREATE INDEX "UserRating_gameType_rating_idx" ON "UserRating"("gameType", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "UserRating_userId_gameType_key" ON "UserRating"("userId", "gameType");

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
