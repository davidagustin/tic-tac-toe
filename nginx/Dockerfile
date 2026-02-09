# ── Build Expo web app ───────────────────────────────
FROM node:20-alpine AS web-builder

WORKDIR /app

# Copy monorepo root package files
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace package.jsons
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/mobile/ ./apps/mobile/

# Build web
WORKDIR /app/apps/mobile
RUN npx expo export --platform web

# ── Nginx with built web app ────────────────────────
FROM nginx:alpine

COPY --from=web-builder /app/apps/mobile/dist /var/www/web

# Note: Running as non-root (USER nginx) is not possible here because
# nginx listens on privileged ports 80/443. Would require switching to
# high ports (8080/8443) and updating docker-compose port mappings.
