# ── Build Stage ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root package files
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace package.jsons
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Generate Prisma client
WORKDIR /app/apps/server
RUN npx prisma generate

# Build
RUN npm run build

# ── Production Stage ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production deps
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/packages/shared/src ./packages/shared/src

WORKDIR /app/apps/server

# Add non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
