#!/bin/bash
set -euo pipefail

echo "Starting deployment..."

APP_DIR="/home/ec2-user/app"
cd "$APP_DIR"

# Step 1: Fetch latest secrets from SSM
echo "Step 1/5: Fetching secrets..."
bash apps/server/scripts/fetch-env.sh

# Step 2: Pull latest code
echo "Step 2/5: Pulling latest code..."
git pull origin main

# Step 3: Build and restart services
echo "Step 3/5: Building and restarting services..."
docker-compose -f docker-compose.prod.yml up -d --build --remove-orphans

# Step 4: Run migrations
echo "Step 4/5: Running migrations..."
sleep 10  # Wait for postgres to be ready
docker-compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy

# Step 5: Health check
echo "Step 5/5: Health check..."
sleep 5
if curl -sf http://localhost/api/health > /dev/null; then
  echo "Deployment successful!"
else
  echo "Health check failed!"
  docker-compose -f docker-compose.prod.yml logs app --tail 30
  exit 1
fi

# Cleanup
docker image prune -af 2>/dev/null || true
