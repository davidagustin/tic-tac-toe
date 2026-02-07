#!/bin/bash
set -euo pipefail

echo "Starting deployment..."

APP_DIR="/home/ec2-user/app"
cd "$APP_DIR"

# Step 1: Fetch latest secrets from SSM
echo "Step 1/5: Fetching secrets..."
./scripts/fetch-env.sh

# Step 2: Pull latest Docker image
echo "Step 2/5: Pulling image..."
if [ -n "${ECR_URL:-}" ] && [ -n "${IMAGE_TAG:-}" ]; then
  aws ecr get-login-password --region us-west-2 | \
    docker login --username AWS --password-stdin "${ECR_URL%/*}"
  docker pull "$ECR_URL:$IMAGE_TAG"
fi

# Step 3: Restart services
echo "Step 3/5: Restarting services..."
docker compose up -d --remove-orphans

# Step 4: Run migrations
echo "Step 4/5: Running migrations..."
sleep 5  # Wait for postgres to be ready
docker compose exec -T app npx prisma migrate deploy

# Step 5: Health check
echo "Step 5/5: Health check..."
sleep 5
if curl -sf http://localhost:3001/api/health > /dev/null; then
  echo "Deployment successful!"
else
  echo "Health check failed!"
  docker compose logs app --tail 30
  exit 1
fi

# Cleanup
docker image prune -af 2>/dev/null || true
