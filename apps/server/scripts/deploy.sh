#!/bin/bash
set -euo pipefail

echo "Starting deployment..."

APP_DIR="/home/ec2-user/app"
cd "$APP_DIR"

# Step 1: Fetch latest secrets from SSM
echo "Step 1/6: Fetching secrets..."
bash apps/server/scripts/fetch-env.sh

# Step 2: Pull latest code
echo "Step 2/6: Pulling latest code..."
git pull origin main

# Step 3: Login to ECR and pull pre-built images
echo "Step 3/6: Pulling Docker images from ECR..."
# ECR_REGISTRY and IMAGE_TAG are set by CI; derive ECR_REGISTRY from ECR_URL as fallback
export ECR_REGISTRY="${ECR_REGISTRY:-$(echo "$ECR_URL" | cut -d'/' -f1)}"
export IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG must be set}"

aws ecr get-login-password --region "${AWS_REGION:-us-west-2}" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker-compose -f docker-compose.prod.yml pull

# Step 4: Restart services
echo "Step 4/6: Restarting services..."
docker-compose -f docker-compose.prod.yml up -d --remove-orphans

# Step 5: Run migrations
echo "Step 5/6: Running migrations..."
sleep 10  # Wait for postgres to be ready
docker exec ttt-app npx prisma migrate deploy

# Step 6: Health check
echo "Step 6/6: Health check..."
sleep 5
if curl -skf https://localhost/api/health > /dev/null; then
  echo "Deployment successful!"
else
  echo "Health check failed!"
  docker-compose -f docker-compose.prod.yml logs app --tail 30
  exit 1
fi

# Cleanup old images
docker image prune -af 2>/dev/null || true
