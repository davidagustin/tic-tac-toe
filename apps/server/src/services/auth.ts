import crypto from "node:crypto";
import { REDIS_KEYS } from "@ttt/shared";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { getRedis } from "../lib/redis";

const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: { token: tokenHash, userId, expiresAt },
  });

  return token;
}

export async function validateRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!refreshToken) return null;
  if (refreshToken.expiresAt < new Date()) {
    // Expired — clean it up
    await prisma.refreshToken.delete({ where: { id: refreshToken.id } });
    return null;
  }

  return refreshToken;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

const RESET_CODE_TTL = 600; // 10 minutes

export async function generateResetCode(email: string): Promise<string> {
  const code = crypto.randomInt(100000, 999999).toString();
  const redis = getRedis();
  const key = `${REDIS_KEYS.PASSWORD_RESET}${email.toLowerCase()}`;
  await redis.set(key, code, "EX", RESET_CODE_TTL);
  return code;
}

export async function validateResetCode(email: string, code: string): Promise<boolean> {
  const redis = getRedis();
  const normalizedEmail = email.toLowerCase();
  const key = `${REDIS_KEYS.PASSWORD_RESET}${normalizedEmail}`;
  const attemptsKey = `reset_attempts:${normalizedEmail}`;

  const attempts = await redis.get(attemptsKey);
  if (attempts && Number.parseInt(attempts, 10) >= 5) {
    await redis.del(key);
    return false;
  }

  const stored = await redis.get(key);
  if (!stored || stored.length !== code.length) {
    await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, 600);
    return false;
  }
  if (!crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(code))) {
    await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, 600);
    return false;
  }

  await redis.del(key);
  await redis.del(attemptsKey);
  return true;
}

export async function resetPassword(email: string, newPassword: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return false;

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await revokeAllUserTokens(user.id);
  return true;
}
