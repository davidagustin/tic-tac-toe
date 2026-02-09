# ── Build Stage ──────────────────────────────────────
FROM dhi.io/node:25-debian13-dev AS builder

WORKDIR /app

# Copy monorepo root package files
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace package.jsons
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (dev included for building)
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Build shared package first
WORKDIR /app/packages/shared
RUN npx tsc

# Generate Prisma client and build server
WORKDIR /app/apps/server
RUN npx prisma generate
RUN npm run build

# ── Production Dependencies Stage ───────────────────
FROM dhi.io/node:25-debian13-dev AS proddeps

WORKDIR /app

# Copy package files for a clean prod-only install
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# ── Production Stage ────────────────────────────────
FROM dhi.io/node:25-debian13 AS runner

WORKDIR /app

# Copy production node_modules (includes prisma CLI + @prisma/client)
COPY --from=proddeps /app/node_modules ./node_modules

# Overlay generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/apps/server

# Run as non-root user
USER 1001

EXPOSE 3001

CMD ["node", "dist/index.js"]
