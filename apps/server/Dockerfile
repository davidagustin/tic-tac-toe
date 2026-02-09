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

# ── System Libraries Stage ──────────────────────────
# Install Prisma's native engine dependencies via apt-get,
# then copy the library files to the minimal runtime image
FROM dhi.io/node:25-debian13-dev AS syslibs

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      zlib1g \
      libzstd1 \
      libssl3t64 \
      libgcc-s1 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/prisma-libs \
    && cp -L /usr/lib/*/libz.so.1 /tmp/prisma-libs/ 2>/dev/null || true \
    && cp -L /usr/lib/*/libzstd.so.1 /tmp/prisma-libs/ 2>/dev/null || true \
    && cp -L /usr/lib/*/libssl.so.3 /tmp/prisma-libs/ 2>/dev/null || true \
    && cp -L /usr/lib/*/libcrypto.so.3 /tmp/prisma-libs/ 2>/dev/null || true \
    && cp -L /usr/lib/*/libgcc_s.so.1 /tmp/prisma-libs/ 2>/dev/null || true \
    && echo "=== Libraries staged ===" && ls -la /tmp/prisma-libs/

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

# Install system libraries required by Prisma query engine
COPY --from=syslibs /tmp/prisma-libs/ /usr/lib/

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
