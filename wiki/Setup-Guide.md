# Setup & Usage -- Step-by-Step Guide

This page walks through every step needed to go from a fresh machine to a running instance of the tic-tac-toe app -- locally, on AWS, and in your hands playing a game. Each step is numbered, every command is spelled out, and nothing is left to inference.

---

## Table of Contents

- [Section 1: Prerequisites](#section-1-prerequisites)
- [Section 2: Local Development Setup](#section-2-local-development-setup-step-by-step)
- [Section 3: AWS Infrastructure Setup](#section-3-aws-infrastructure-setup-step-by-step)
- [Section 4: Docker Production Build](#section-4-docker-production-build-step-by-step)
- [Section 5: CI/CD Deployment](#section-5-cicd-deployment-step-by-step)
- [Section 6: Using the App](#section-6-using-the-app-step-by-step)
- [Section 7: Troubleshooting](#section-7-troubleshooting)

---

## Section 1: Prerequisites

You need the following tools installed before anything else. Versions listed are the minimum required.

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 18+ | JavaScript runtime for server and build tools |
| npm | 9+ | Package manager (ships with Node.js) |
| Docker | 20+ | Containers for PostgreSQL, Redis, and production builds |
| Docker Compose | 2.0+ | Multi-container orchestration |
| AWS CLI | 2.0+ | AWS resource management (only for deployment) |
| Terraform | 1.5+ | Infrastructure as code (only for deployment) |
| Git | 2.0+ | Source control |

### Install on macOS (Homebrew)

If you do not have Homebrew, install it first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install all prerequisites:

```bash
# Node.js 20 (LTS) -- this also installs npm
brew install node@20

# Docker Desktop -- includes Docker Engine and Docker Compose
brew install --cask docker

# AWS CLI v2
brew install awscli

# Terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Git (macOS ships with git, but you can update it)
brew install git
```

After installing Docker Desktop, **open the Docker Desktop application from your Applications folder**. It needs to be running before any Docker commands will work. You will see a whale icon appear in your menu bar when it is ready.

### Install on Ubuntu (apt)

```bash
# Update package index
sudo apt update && sudo apt upgrade -y

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker Engine
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to the docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER
# Log out and log back in for this to take effect, or run:
newgrp docker

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Terraform
sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update
sudo apt install -y terraform

# Git
sudo apt install -y git
```

### Verify Everything Is Installed

Run each of these commands and confirm the output shows a version number at or above the minimum:

```bash
node --version
# Expected: v20.x.x (or v18.x.x minimum)

npm --version
# Expected: 10.x.x (or 9.x.x minimum)

docker --version
# Expected: Docker version 24.x.x or higher

docker compose version
# Expected: Docker Compose version v2.x.x

aws --version
# Expected: aws-cli/2.x.x

terraform --version
# Expected: Terraform v1.5.x or higher

git --version
# Expected: git version 2.x.x
```

If any command returns "command not found", go back and re-run the installation step for that tool.

---

## Section 2: Local Development Setup (Step by Step)

This section gets the full app running on your local machine. By the end, you will have the server serving API requests and Socket.IO events, and the mobile app running in your browser or simulator.

### Step 1: Clone the repository

Open your terminal and navigate to whatever directory you keep projects in, then clone:

```bash
git clone https://github.com/davidagustin/tic-tac-toe.git
```

This creates a `tic-tac-toe/` directory with the full monorepo.

### Step 2: Enter the project directory

```bash
cd tic-tac-toe
```

You are now in the monorepo root. All subsequent commands assume you are in this directory unless stated otherwise.

### Step 3: Install all dependencies

```bash
npm install
```

This is run from the **root** of the repository. Turborepo and npm workspaces handle installing dependencies for all three workspaces (`apps/server`, `apps/mobile`, `packages/shared`) in a single command. You will see output mentioning all three packages. This may take 1-3 minutes depending on your internet connection.

When it finishes, you should see a `node_modules/` directory in the project root, as well as inside `apps/server/`, `apps/mobile/`, and `packages/shared/`.

### Step 4: Start PostgreSQL and Redis with Docker Compose

The project includes a `docker-compose.yml` that runs PostgreSQL 16 and Redis 7 in containers:

```bash
docker compose up -d
```

The `-d` flag runs the containers in the background (detached mode).

**What this starts:**
- **PostgreSQL 16** on port `5432` (user: `ttt_user`, password: `ttt_password`, database: `ttt_db`)
- **Redis 7** on port `6379`

Verify both containers are running and healthy:

```bash
docker compose ps
```

You should see two containers (`ttt-postgres` and `ttt-redis`) both with status "Up" and "(healthy)". If either says "starting", wait 10-15 seconds and run the command again.

### Step 5: Set up the server environment file

Copy the example environment file:

```bash
cp apps/server/.env.example apps/server/.env
```

Now open `apps/server/.env` in your editor. The default values work for local development with the Docker Compose databases. Here is what each variable means and what to set:

| Variable | Default Value | What To Do |
|----------|--------------|------------|
| `PORT` | `3001` | Leave as-is. The server listens on this port. |
| `HOST` | `0.0.0.0` | Leave as-is. Binds to all interfaces. |
| `NODE_ENV` | `development` | Leave as-is. |
| `DATABASE_URL` | `postgresql://ttt_user:ttt_password@localhost:5432/ttt_db` | Leave as-is. Matches the Docker Compose PostgreSQL credentials. |
| `REDIS_URL` | `redis://localhost:6379` | Leave as-is. Matches the Docker Compose Redis. |
| `JWT_ACCESS_SECRET` | `change-me-minimum-16-characters` | **Change this** to any random string of 16+ characters. Example: `my-local-access-secret-1234` |
| `JWT_REFRESH_SECRET` | `change-me-minimum-16-characters` | **Change this** to a *different* random string of 16+ characters. Example: `my-local-refresh-secret-5678` |
| `JWT_ACCESS_EXPIRY` | `15m` | Leave as-is. Access tokens expire in 15 minutes. |
| `JWT_REFRESH_EXPIRY` | `7d` | Leave as-is. Refresh tokens expire in 7 days. |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | **Optional.** Only needed if you want Google OAuth login. Leave the placeholder for now. |
| `GOOGLE_CLIENT_SECRET` | `your-google-client-secret` | **Optional.** Same as above. |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` | Leave as-is if you plan to set up Google OAuth later. |

Save the file.

### Step 6: Generate the Prisma client

The Prisma client is a type-safe database client generated from the schema. You must generate it before the server can interact with PostgreSQL:

```bash
cd apps/server && npx prisma generate
```

You should see output that says "Generated Prisma Client" with a checkmark. Then return to the project root:

```bash
cd ../..
```

### Step 7: Run database migrations

Migrations create the actual database tables (users, games, moves, refresh tokens, etc.) in your local PostgreSQL:

```bash
cd apps/server && npx prisma migrate dev
```

When prompted for a name, you can press Enter to accept the default. This applies all existing migration files from `apps/server/prisma/migrations/`. You should see output listing each migration that was applied, ending with "All migrations have been successfully applied."

Return to the project root:

```bash
cd ../..
```

### Step 8: Build the shared package

The shared package (`@ttt/shared`) contains game logic, types, and constants used by both the server and mobile app. It must be compiled from TypeScript to JavaScript before either app can import it:

```bash
npm run build --workspace=packages/shared
```

You should see TypeScript compile without errors. This creates a `packages/shared/dist/` directory with the compiled output.

### Step 9: Start the development server

```bash
npm run dev --workspace=apps/server
```

The Fastify server starts on `http://localhost:3001`. You should see log output from Pino (the Fastify logger) indicating the server is listening. Look for a line containing `Server listening at http://0.0.0.0:3001` or similar.

**Leave this terminal running.** Open a new terminal tab or window for the next step.

### Step 10: Start the Expo mobile app

In your new terminal, from the project root:

```bash
npm run dev --workspace=apps/mobile
```

This starts the Expo development server. After it initializes (10-20 seconds), you will see a QR code in the terminal and a menu of options:

```
› Press w │ open web
› Press i │ open iOS simulator
› Press a │ open Android emulator
› Press r │ reload app
```

**To run in a browser (easiest):** Press `w`. Your default browser opens to `http://localhost:8081` with the app running.

**To run on iOS Simulator (macOS only):** Press `i`. This requires Xcode to be installed. The iOS Simulator launches and the app loads automatically.

**To run on Android Emulator:** Press `a`. This requires Android Studio with an AVD (Android Virtual Device) configured and running.

**To run on a physical device:** Install the "Expo Go" app from the App Store (iOS) or Google Play Store (Android). Scan the QR code shown in the terminal with your phone's camera (iOS) or the Expo Go app (Android). Your phone must be on the same Wi-Fi network as your development machine.

### Step 11: Verify everything works

1. Open `http://localhost:8081` in your browser (if not already open from pressing `w`).
2. You should see the app's login screen with the dark theme (dark background, blue and rose accent colors).
3. Tap **"Continue as Guest"** to enter the app without creating an account.
4. You should arrive at the lobby screen. If the server is running correctly, the online player count should appear and you should not see any connection errors.

**If the app loads but shows connection errors**, check that:
- The server terminal (from Step 9) is still running without errors.
- Docker containers are still healthy (`docker compose ps`).

### Step 12: (Optional) Open Prisma Studio

Prisma Studio is a GUI for browsing and editing your database. Useful for inspecting data during development:

```bash
cd apps/server && npx prisma studio
```

This opens a browser tab at `http://localhost:5555` showing all your database tables. You can view, create, edit, and delete records.

---

## Section 3: AWS Infrastructure Setup (Step by Step)

This section provisions the production infrastructure on AWS. By the end, you will have an EC2 instance, security groups, an Elastic IP, and all secrets stored in SSM Parameter Store -- all managed by Terraform.

**You only need this section if you want to deploy to production.** Local development (Section 2) works without any AWS setup.

### Step 1: Create an AWS account (or use an existing one)

1. Go to [https://aws.amazon.com/](https://aws.amazon.com/).
2. Click **"Create an AWS Account"** in the top right.
3. Follow the signup wizard: enter your email, set a root password, provide payment information (a credit card is required but the free tier covers this project's costs), and verify your phone number.
4. Once your account is active, sign in to the [AWS Management Console](https://console.aws.amazon.com/).

If you already have an AWS account, sign in and proceed to Step 2.

### Step 2: Create an IAM user with programmatic access

Do **not** use your root account for CLI operations. Create a dedicated IAM user:

1. In the AWS Console, go to **IAM** (type "IAM" in the search bar at the top and click the result).
2. In the left sidebar, click **Users**.
3. Click the **"Create user"** button.
4. Enter a username: `ttt-deployer`. Click **Next**.
5. On the "Set permissions" page, select **"Attach policies directly"**.
6. Search for and check the following policies:
   - `AmazonEC2FullAccess` -- needed for EC2 instances, security groups, Elastic IPs.
   - `AmazonSSMFullAccess` -- needed for SSM Parameter Store secrets.
   - `AmazonEC2ContainerRegistryFullAccess` -- needed for pushing Docker images to ECR.
   - `IAMFullAccess` -- needed for Terraform to create IAM roles and policies for EC2.
7. Click **Next**, then **"Create user"**.
8. Click on the user you just created (`ttt-deployer`) from the user list.
9. Click the **"Security credentials"** tab.
10. Scroll down to **"Access keys"** and click **"Create access key"**.
11. Select **"Command Line Interface (CLI)"** as the use case. Check the confirmation checkbox at the bottom. Click **Next**.
12. Optionally add a description tag (e.g., "Terraform and CI/CD"). Click **"Create access key"**.
13. **IMPORTANT:** Copy the **Access key ID** and **Secret access key** NOW. The secret key is only shown once. Save both in a secure location (password manager).

### Step 3: Create an EC2 key pair

This key pair lets you (and the CI/CD pipeline) SSH into the EC2 instance:

1. In the AWS Console, go to **EC2** (type "EC2" in the search bar).
2. In the left sidebar under "Network & Security", click **Key Pairs**.
3. Click **"Create key pair"**.
4. Name: `ttt-server-key`. Key pair type: **RSA**. Private key file format: **.pem**.
5. Click **"Create key pair"**. Your browser downloads `ttt-server-key.pem`.
6. Move the key file to your SSH directory and set permissions:

```bash
mv ~/Downloads/ttt-server-key.pem ~/.ssh/ttt-server-key.pem
chmod 400 ~/.ssh/ttt-server-key.pem
```

### Step 4: Configure the AWS CLI

Run the AWS CLI configuration wizard:

```bash
aws configure
```

It prompts for four values:

| Prompt | What to Enter |
|--------|---------------|
| AWS Access Key ID | The Access Key ID from Step 2 |
| AWS Secret Access Key | The Secret Access Key from Step 2 |
| Default region name | `us-west-2` (or your preferred region -- match the Terraform config) |
| Default output format | `json` |

Verify the configuration works:

```bash
aws sts get-caller-identity
```

This should return JSON with your account ID, user ARN, and user ID. If you get an error, double-check the credentials you entered.

### Step 5: Create an ECR repository

The Docker images need somewhere to live. Create an ECR (Elastic Container Registry) repository:

```bash
aws ecr create-repository --repository-name ttt-server --region us-west-2
aws ecr create-repository --repository-name ttt-nginx --region us-west-2
```

Note the `repositoryUri` from the output of each command. It looks like `123456789012.dkr.ecr.us-west-2.amazonaws.com/ttt-server`. You will need the registry portion (`123456789012.dkr.ecr.us-west-2.amazonaws.com`) later.

### Step 6: Create a Terraform variables file

Navigate to the Terraform directory:

```bash
cd infra/terraform
```

Create a `terraform.tfvars` file with your specific values:

```bash
cat > terraform.tfvars << 'EOF'
key_pair_name    = "ttt-server-key"
ssh_allowed_cidr = ["YOUR_HOME_IP/32"]
EOF
```

Replace `YOUR_HOME_IP` with your actual public IP address. To find it:

```bash
curl -s https://api.ipify.org
```

For example, if your IP is `203.0.113.42`, the file should say `ssh_allowed_cidr = ["203.0.113.42/32"]`.

### Step 7: Initialize Terraform

Still in the `infra/terraform` directory:

```bash
terraform init
```

This downloads the AWS provider plugin. You should see "Terraform has been successfully initialized!" in the output.

### Step 8: Review the Terraform plan

See what Terraform will create before committing:

```bash
terraform plan
```

Review the output. It should show resources to be created:
- `aws_security_group.ttt_server` -- Security group with rules for SSH, HTTP, HTTPS.
- `aws_iam_role.ec2_role` -- IAM role for EC2 to access SSM.
- `aws_iam_instance_profile.ec2_profile` -- Instance profile attaching the role.
- `aws_instance.ttt_server` -- The EC2 t2.micro instance.
- `aws_eip.ttt_server` -- Elastic IP (static public IP).
- Various SSM parameters and IAM policy attachments from the secrets module.

The plan should show approximately 15-20 resources to add, 0 to change, 0 to destroy.

### Step 9: Apply the Terraform configuration

```bash
terraform apply
```

Terraform shows the plan again and asks for confirmation. Type `yes` and press Enter.

This takes 2-5 minutes. Terraform creates all resources in the correct dependency order. When it finishes, you will see outputs:

```
Outputs:

server_public_ip = "54.x.x.x"
ssh_command = "ssh -i ~/.ssh/ttt-server-key.pem ec2-user@54.x.x.x"
```

**Save these outputs.** The `server_public_ip` is your Elastic IP. The `ssh_command` is how you connect to the server.

### Step 10: Verify SSH access to the EC2 instance

Wait 2-3 minutes for the EC2 user data script (which installs Docker and Docker Compose) to finish, then:

```bash
ssh -i ~/.ssh/ttt-server-key.pem ec2-user@<YOUR_ELASTIC_IP>
```

Replace `<YOUR_ELASTIC_IP>` with the IP from the Terraform output. Type `yes` when asked about the fingerprint.

Once connected, verify Docker is installed:

```bash
docker --version
docker compose version
```

If Docker is not found, the user data script may still be running. Wait another minute and try again:

```bash
sudo tail -f /var/log/cloud-init-output.log
```

This shows the progress of the initialization script. Wait until it completes, then log out and back in (`exit`, then SSH again) so the docker group membership takes effect.

Type `exit` to disconnect from the EC2 instance.

### Step 11: Set up GitHub Secrets for CI/CD

Go to your GitHub repository in a web browser: `https://github.com/davidagustin/tic-tac-toe`.

1. Click **Settings** (tab at the top of the repository page).
2. In the left sidebar, under "Security", click **Secrets and variables**, then **Actions**.
3. Click **"New repository secret"** for each of the following:

| Secret Name | Value | Where to Find It |
|-------------|-------|-------------------|
| `AWS_ACCESS_KEY_ID` | The IAM user's access key ID | From Step 2, when you created the access key |
| `AWS_SECRET_ACCESS_KEY` | The IAM user's secret access key | From Step 2, when you created the access key |
| `AWS_REGION` | `us-west-2` | The region you used in Terraform |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account number | AWS Console top-right dropdown, or `aws sts get-caller-identity` |
| `EC2_HOST` | The Elastic IP (e.g., `54.x.x.x`) | From Step 9 Terraform output (`server_public_ip`) |
| `EC2_SSH_KEY` | The **entire contents** of `~/.ssh/ttt-server-key.pem` | Open the file, copy everything including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` |
| `EC2_SG_ID` | The security group ID (e.g., `sg-0abc1234def56789`) | Run `terraform output` or find it in the AWS Console under EC2 > Security Groups > `ttt-server-sg` |

To get the security group ID from Terraform:

```bash
cd infra/terraform
terraform show | grep sg-
```

Return to the project root:

```bash
cd ../..
```

---

## Section 4: Docker Production Build (Step by Step)

This section tests the production Docker build locally before deploying to AWS. This helps catch Docker-specific issues (missing files, bad paths, compilation errors) on your machine where debugging is easier.

### Step 1: Build the server Docker image locally

From the **project root** (not `apps/server/`):

```bash
docker build -f apps/server/Dockerfile -t ttt-server:local .
```

The build context is the project root (`.`) because the Dockerfile needs access to both `apps/server/` and `packages/shared/`. The multi-stage build:
1. Installs all dependencies (including dev).
2. Compiles the shared package (`packages/shared/`).
3. Generates the Prisma client.
4. Compiles the server TypeScript.
5. Creates a lean production image with only compiled JavaScript and production dependencies.

This takes 2-5 minutes on the first run (subsequent builds are faster due to Docker layer caching). You should see "Successfully tagged ttt-server:local" at the end.

### Step 2: Run the production stack with Docker Compose

The production Docker Compose file (`docker-compose.prod.yml`) runs four services: app, PostgreSQL, Redis, and Nginx. For local testing, you need to provide the environment variables it expects:

```bash
# Set required environment variables for the production compose file
export ECR_REGISTRY=local
export IMAGE_TAG=local

# Stop the dev Docker Compose stack if it is running (to free ports)
docker compose down

# Tag your local image to match what the compose file expects
docker tag ttt-server:local local/ttt-server:local
```

**Note:** The production `docker-compose.prod.yml` also expects an Nginx image and SSL certificates. For a full local production test, you may want to use the dev compose file (`docker-compose.yml`) with your locally built server image instead. The primary goal of this step is verifying the Docker image builds and the server starts correctly.

### Step 3: Verify the server image runs

Run the server image directly to test it (with the dev databases still running):

```bash
# Restart dev databases
docker compose up -d

# Run the server image, connecting to dev databases on the host network
docker run --rm \
  --network host \
  -e PORT=3001 \
  -e HOST=0.0.0.0 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://ttt_user:ttt_password@localhost:5432/ttt_db \
  -e REDIS_URL=redis://localhost:6379 \
  -e JWT_ACCESS_SECRET=test-access-secret-local \
  -e JWT_REFRESH_SECRET=test-refresh-secret-local \
  -e JWT_ACCESS_EXPIRY=15m \
  -e JWT_REFRESH_EXPIRY=7d \
  ttt-server:local
```

You should see the Fastify server start and log that it is listening on port 3001.

### Step 4: Check the health endpoint

In a separate terminal:

```bash
curl http://localhost:3001/api/health
```

You should get a JSON response indicating the server is healthy. If you get a connection error, check the Docker logs from Step 3 for any startup errors.

Press `Ctrl+C` in the terminal running the Docker container to stop it.

---

## Section 5: CI/CD Deployment (Step by Step)

Once your AWS infrastructure is set up (Section 3) and GitHub Secrets are configured (Step 11), deployments happen automatically. Here is what happens and how to monitor it.

### Step 1: Push to main to trigger a deployment

Every push to the `main` branch triggers the CI/CD pipeline. The pipeline has three jobs that run sequentially:

1. **Test** -- Type-checks the shared package, runs the 14 Vitest unit tests, builds the shared package, generates the Prisma client, and type-checks the server.
2. **Build** -- Builds the server and Nginx Docker images to verify they compile.
3. **Deploy** (only on `main` pushes, not PRs) -- Builds and pushes the images to ECR with the commit SHA as the tag, dynamically opens SSH to the GitHub Actions runner IP, deploys via SSH, and closes the SSH rule.

To trigger it:

```bash
git add .
git commit -m "deploy: initial production deployment"
git push origin main
```

### Step 2: Monitor the GitHub Actions workflow

1. Go to your repository on GitHub: `https://github.com/davidagustin/tic-tac-toe`.
2. Click the **"Actions"** tab at the top of the page.
3. You should see the latest workflow run at the top of the list, named "CI" with your commit message.
4. Click on it to see the three jobs: **test**, **build**, **deploy**.
5. Click on any job to expand it and see the step-by-step logs.
6. A green checkmark means the job passed. A red X means it failed -- click to see the error logs.

The full pipeline typically takes 4-8 minutes:
- Test: ~1-2 minutes
- Build: ~2-3 minutes
- Deploy: ~2-3 minutes

### Step 3: Verify the deployment on EC2

Once the deploy job completes (green checkmark), SSH into the EC2 instance:

```bash
ssh -i ~/.ssh/ttt-server-key.pem ec2-user@<YOUR_ELASTIC_IP>
```

Check that the Docker Compose stack is running:

```bash
cd ~/app
docker compose -f docker-compose.prod.yml ps
```

You should see four containers: `ttt-app`, `ttt-postgres`, `ttt-redis`, and `ttt-nginx`, all with status "Up".

Check the application logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

You should see the Fastify server logs indicating it started successfully. Press `Ctrl+C` to stop following the logs.

### Step 4: Verify the live application

From your local machine, hit the health endpoint on the production server:

```bash
curl http://<YOUR_ELASTIC_IP>/api/health
```

If you have set up a domain with SSL (via Let's Encrypt and Nginx), use the domain:

```bash
curl https://your-domain.com/api/health
```

You should get a healthy JSON response. The server is live.

---

## Section 6: Using the App (Step by Step)

This section walks through the actual user experience of the app, from opening it to completing a game.

### Step 1: Open the app

**Local development:** Open `http://localhost:8081` in your browser (after running the Expo dev server from Section 2, Step 10).

**Production:** Open the app on your mobile device via Expo Go (scanning the QR code) or through whatever distribution method you have set up.

You should see the **Login screen** with a dark background (`#0a0a0a`), the app title, and two options for entering the app.

### Step 2: Create an account or continue as guest

You have two choices:

**Option A -- Continue as Guest (fastest):**
1. Tap the **"Continue as Guest"** button.
2. A random guest name is generated for you (e.g., "Guest-7k3m").
3. You skip straight to the Lobby. Note: as a guest, you can join and play in rooms, but you **cannot create rooms** (spam prevention).

**Option B -- Register a new account:**
1. Tap on the registration option or navigate to the registration screen.
2. Enter an **email address** (e.g., `player1@example.com`).
3. Enter a **password** (minimum requirements depend on server validation).
4. Tap **"Register"**.
5. If successful, you are authenticated and proceed to the Lobby. Your account is stored in PostgreSQL, and your games will be persisted to your profile.

**Option C -- Login with existing account:**
1. Enter your email and password.
2. Tap **"Login"**.
3. The server issues a JWT access token (15-minute expiry) and a refresh token (7-day expiry), both stored securely on the device.

### Step 3: Explore the Lobby

After logging in (or continuing as guest), you arrive at the **Lobby screen**. Here is what you see:

- **Online count** at the top -- shows how many players are currently connected to the server.
- **Room list** -- a scrollable list of rooms that other players have created. Each room entry shows the room name, number of players, and whether it is password-protected.
- **Chat panel** -- a lobby-wide chat where all connected players can send messages. Messages appear in real time via Socket.IO.
- **"Create Room" button** -- visible only if you are a registered user (not a guest).

### Step 4: Create a room

1. Tap the **"Create Room"** button (you must be a registered user).
2. A modal or screen appears asking for:
   - **Room name** -- enter a name (e.g., "My Room").
   - **Password** (optional) -- if you set a password, other players must enter it to join.
3. Tap **"Create"**.
4. You are navigated to the **Room screen**.

### Step 5: The Room screen (waiting for opponent)

You are now in the Room screen. Here is what you see:

- **Your name** in the **X slot** (the room creator is always X for the first game).
- **Empty O slot** with a "Waiting for opponent..." message.
- **Room code** -- displayed on screen. Share this with a friend so they can find and join your room from the lobby.
- **Chat panel** -- a per-room chat (separate from the lobby chat).
- **Ready button** -- grayed out or hidden until an opponent joins.

### Step 6: Opponent joins

When another player joins your room (either by tapping your room in the lobby list, or by entering the room code):

- Their name appears in the **O slot**.
- Both players now see each other's names.
- The **"Ready Up"** button becomes available for both players.
- If the room is password-protected, the joining player was prompted to enter the password before arriving here.

### Step 7: Both players ready up

1. Tap the **"Ready Up"** button.
2. Your button changes to show you are ready (e.g., a checkmark or highlighted state).
3. Wait for the other player to also tap "Ready Up".
4. Once **both** players are ready, a **3-second countdown** automatically begins.
5. The countdown is visible on screen: **3... 2... 1...**
6. The countdown prevents the jarring experience of being thrown into a game unexpectedly.

### Step 8: Play the game

After the countdown, the **game board** appears -- a 3x3 grid of cells.

- **X goes first.** If you are X, it is your turn. The UI indicates whose turn it is.
- **Tap an empty cell** to place your mark (X or O).
- The move is sent to the server via Socket.IO. The server validates the move (correct turn, cell is empty, game is still active) and broadcasts the updated board to both players.
- The **opponent's move** appears on your board in real time (sub-100ms latency).
- Turns alternate: X, O, X, O, etc.
- If you try to tap a cell that is already occupied, or tap when it is not your turn, nothing happens (client-side validation prevents the tap, and even if bypassed, the server rejects invalid moves).

### Step 9: Game ends

The game ends when:

- **A player wins** -- three marks in a row (horizontal, vertical, or diagonal). The winning line is highlighted.
- **It is a draw** -- all 9 cells are filled and no one has three in a row.
- **A player forfeits** -- a player taps the forfeit button, conceding the game.

### Step 10: Game Over modal

When the game ends, a **Game Over modal** appears showing:

- **The result:** "X Wins!", "O Wins!", or "Draw!"
- **Two buttons:**
  - **"Rematch"** -- starts a new game in the same room. On rematch, **marks swap** (if you were X, you become O, and vice versa). This keeps things fair across multiple rounds.
  - **"Leave"** -- exits the room and returns you to the Lobby.

If both players tap "Rematch", a new game begins with the swapped marks. If only one player wants a rematch and the other leaves, the remaining player goes back to waiting for a new opponent.

### Step 11: Spectating (optional)

If a room already has two players and a game in progress, additional users (up to 8 spectators) can join the room to watch the game in real time. Spectators see the board update live but cannot place marks.

---

## Section 7: Troubleshooting

### "Loading room..." freeze or infinite loading

**Cause:** This was a known issue in earlier versions where the room screen would get stuck loading.

**Fix:** Pull the latest code and redeploy:

```bash
git pull origin main
```

If you are running locally, restart the server (`Ctrl+C`, then `npm run dev --workspace=apps/server`). If deployed, push to main to trigger a redeploy.

### Socket connection fails / "Disconnected" message

**Possible causes and fixes:**

1. **Server is not running.** Check that the server process is alive:
   - Local: Is the terminal running `npm run dev --workspace=apps/server` still active?
   - Production: SSH to EC2 and run `docker compose -f docker-compose.prod.yml ps`.

2. **CORS misconfiguration.** The server must allow the origin of the mobile app. In development, this is usually `http://localhost:8081`. Check the CORS plugin configuration in `apps/server/src/plugins/`.

3. **Wrong API_URL.** The mobile app connects to the server URL configured in its environment/config. Verify it points to the correct host and port (e.g., `http://localhost:3001` for local dev, or your production domain for production).

4. **Firewall or network issue.** If running on a physical device, ensure the device and your development machine are on the same Wi-Fi network. Your machine's firewall may need to allow connections on port 3001.

### Prisma migration fails

**Error: "Can't reach database server at `localhost:5432`"**

PostgreSQL is not running. Start it:

```bash
docker compose up -d postgres
```

Wait for it to be healthy:

```bash
docker compose ps
```

Then retry the migration:

```bash
cd apps/server && npx prisma migrate dev
```

**Error: "Database `ttt_db` does not exist"**

The database was not created. The Docker Compose file should create it automatically. If not, connect manually:

```bash
docker exec -it ttt-postgres psql -U ttt_user -c "CREATE DATABASE ttt_db;"
```

### Docker build fails

**Error: "COPY failed: file not found in build context"**

You are running the build from the wrong directory. The Docker build **must** be run from the **project root**, not from `apps/server/`:

```bash
# CORRECT (from project root):
docker build -f apps/server/Dockerfile -t ttt-server:local .

# WRONG (from apps/server/):
cd apps/server && docker build -t ttt-server:local .
```

**Error: "tsc: command not found" or TypeScript compilation errors during build**

The shared package may have issues. Try building it locally first:

```bash
npm run build --workspace=packages/shared
```

If it fails locally, fix the TypeScript errors before attempting the Docker build.

### Redis connection refused

**Error: "ECONNREFUSED 127.0.0.1:6379" or "Connection refused"**

Redis is not running. Start it:

```bash
docker compose up -d redis
```

Verify it is running and accepting connections:

```bash
docker exec -it ttt-redis redis-cli ping
```

You should get `PONG`. If the container is not starting, check its logs:

```bash
docker compose logs redis
```

### `npm install` fails with workspace errors

**Error: "could not resolve workspace dependency"**

This usually means the workspace structure is incorrect. Verify you are in the project root:

```bash
ls package.json turbo.json apps/ packages/
```

All four should exist. If they do, try clearing the npm cache and reinstalling:

```bash
rm -rf node_modules package-lock.json apps/*/node_modules packages/*/node_modules
npm install
```

### Expo app shows a blank white screen

**Cause:** The shared package is not built, so imports from `@ttt/shared` fail silently.

**Fix:** Build the shared package:

```bash
npm run build --workspace=packages/shared
```

Then restart the Expo dev server (press `r` in the Expo terminal, or stop and restart it).

### GitHub Actions deploy job fails

1. Go to the **Actions** tab on your GitHub repo.
2. Click the failed workflow run.
3. Click the **deploy** job.
4. Expand the failed step to see the error.

**Common failures:**
- **"Could not resolve host"** -- AWS credentials may be wrong. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub Secrets.
- **"Permission denied (publickey)"** -- The `EC2_SSH_KEY` secret is incorrect. Make sure you pasted the entire `.pem` file contents including the header and footer lines.
- **"Connection timed out"** -- The `EC2_HOST` secret may be wrong, or the EC2 instance is stopped. Check the Elastic IP in the AWS Console.
- **"security group rule already exists"** -- A previous deploy may have left a stale SSH rule. Go to AWS Console > EC2 > Security Groups > `ttt-server-sg` > Inbound Rules, and manually delete any rule tagged `github-actions-temp`.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md) | [Build Guide](Build-Guide.md) | Setup Guide
