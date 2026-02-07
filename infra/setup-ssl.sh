#!/bin/bash
# Run this on the EC2 instance AFTER the domain DNS is pointing to the server.
# Usage: bash setup-ssl.sh
set -euo pipefail

DOMAIN="game-practice-aws.com"
EMAIL="davidagustin.dev@gmail.com"

echo "=== SSL Setup for $DOMAIN ==="

# Step 1: Stop nginx to free port 80
echo "Step 1/4: Stopping nginx..."
cd /home/ec2-user/app
sudo docker-compose -f docker-compose.prod.yml stop nginx

# Step 2: Get certificate using standalone mode
echo "Step 2/4: Requesting Let's Encrypt certificate..."
sudo certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

# Step 3: Pull latest code and restart all services
echo "Step 3/4: Restarting services with SSL..."
git pull origin main
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Step 4: Verify
echo "Step 4/4: Verifying..."
sleep 5
if curl -sf "https://$DOMAIN/api/health" > /dev/null; then
  echo "SSL setup complete! https://$DOMAIN is live."
else
  echo "HTTPS not responding yet. Check: sudo docker-compose -f docker-compose.prod.yml logs nginx"
fi

# Enable auto-renewal
echo "Enabling auto-renewal..."
sudo systemctl start certbot-renew.timer
sudo systemctl enable certbot-renew.timer

echo "Done! Certificate will auto-renew."
