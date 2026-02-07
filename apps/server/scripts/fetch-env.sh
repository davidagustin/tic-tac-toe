#!/bin/bash
# Fetches all SSM parameters under the project prefix
# and writes them to a .env file for Docker Compose.
#
# This runs on the EC2 host BEFORE docker compose up.
# The .env file is ephemeral — never committed to git.

set -euo pipefail

PREFIX="${SSM_PREFIX:-/ttt/prod}"
REGION="${AWS_REGION:-us-west-2}"
ENV_FILE="${ENV_FILE_PATH:-/home/ec2-user/app/.env}"

echo "Fetching secrets from SSM (prefix: $PREFIX)..."

# Fetch all parameters under the prefix
PARAMS=$(aws ssm get-parameters-by-path \
  --path "$PREFIX" \
  --recursive \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].{Name:Name,Value:Value}" \
  --output json)

# Clear existing env file
> "$ENV_FILE"

# Map SSM parameter paths to ENV variable names
# /ttt/prod/database/password → POSTGRES_PASSWORD
echo "$PARAMS" | python3 -c "
import json, sys

mapping = {
    'database/username': 'POSTGRES_USER',
    'database/password': 'POSTGRES_PASSWORD',
    'database/name': 'POSTGRES_DB',
    'database/url': 'DATABASE_URL',
    'redis/password': 'REDIS_PASSWORD',
    'redis/url': 'REDIS_URL',
    'jwt/access-secret': 'JWT_ACCESS_SECRET',
    'jwt/refresh-secret': 'JWT_REFRESH_SECRET',
    'app/node-env': 'NODE_ENV',
    'app/port': 'PORT',
    'oauth/google-client-id': 'GOOGLE_CLIENT_ID',
    'oauth/google-client-secret': 'GOOGLE_CLIENT_SECRET',
    'oauth/google-callback-url': 'GOOGLE_CALLBACK_URL',
}

prefix = '${PREFIX}'
params = json.load(sys.stdin)

for param in params:
    # Extract the relative path after prefix
    name = param['Name']
    relative = name[len(prefix)+1:]  # Remove prefix + leading slash

    if relative in mapping:
        env_name = mapping[relative]
        value = param['Value']
        print(f'{env_name}={value}')
" >> "$ENV_FILE"

# Add HOST (not a secret, just config)
echo "HOST=0.0.0.0" >> "$ENV_FILE"

# Set permissions — only owner can read
chmod 600 "$ENV_FILE"

PARAM_COUNT=$(grep -c '=' "$ENV_FILE")
echo "Wrote $PARAM_COUNT environment variables to $ENV_FILE"
