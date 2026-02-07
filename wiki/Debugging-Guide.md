# CI/CD Debugging Guide

A real-world debugging journal from building and deploying a TypeScript monorepo to AWS. Each scenario includes symptoms, diagnosis, fix, and lessons learned.

---

## 1. TypeScript Literal Widening in Test Files

### Symptoms
```
Type '(string | null)[]' is not assignable to type 'Board'
```

TypeScript compilation failed in test files when creating board fixtures for unit tests.

### Diagnosis
TypeScript's type inference widened our literal array:
```typescript
// TypeScript infers this as (string | null)[]
const board = ['X', 'O', null, 'X', 'O', null, 'X', 'O', null];

// But Board is defined as:
type Cell = 'X' | 'O' | null;
type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
```

The problem is **literal type widening**: TypeScript treats string literals as `string` unless told otherwise. Our `Board` type requires a fixed-length tuple of specific literals (`'X'`, `'O'`, or `null`), not a variable-length array of general strings.

### Fix
Add explicit type annotation to the variable:
```typescript
// Correct: annotate the variable
const board: Board = ['X', 'O', null, 'X', 'O', null, 'X', 'O', null];
```

Not individual elements:
```typescript
// Unnecessary: annotating each element is verbose
const board = ['X' as const, 'O' as const, null, ...];
```

### Lesson
**When TypeScript literal types widen, annotate the variable, not each element.** This is especially common in:
- Test fixtures
- Configuration objects
- Union type arrays

The type annotation tells TypeScript to enforce the stricter type from the start, preventing widening.

---

## 2. Monorepo Package Resolution in CI

### Symptoms
```
apps/server/src/services/game.ts:1:32 - error TS2307: Cannot find module '@ttt/shared' or its corresponding type declarations.
```

30+ similar errors during CI lint step, all pointing to `@ttt/shared` imports. The same code compiled fine locally.

### Diagnosis
Our monorepo uses workspace packages:
```json
// apps/server/package.json
{
  "dependencies": {
    "@ttt/shared": "workspace:*"
  }
}

// packages/shared/package.json
{
  "name": "@ttt/shared",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

The CI workflow only ran `tsc --noEmit` (type-checking without output) in the shared package. Since `package.json` points `main` to `dist/index.js`, but no `dist/` folder existed, TypeScript couldn't resolve the module.

Locally, we had old `dist/` artifacts from previous builds, masking the issue.

### Fix
Add a build step for workspace dependencies **before** consuming packages run their lint/build:

```yaml
- name: Build shared package
  run: cd packages/shared && npx tsc

- name: Lint server
  run: cd apps/server && npm run lint
```

### Lesson
**In monorepos, workspace packages that reference `dist/` need to be built in dependency order.**

When using TypeScript project references or workspace dependencies:
1. Always build dependencies first
2. Use a build tool like Turborepo or Nx to handle topological order automatically
3. In CI, never rely on artifacts from local dev environments

---

## 3. Docker Build OOM on t2.micro (1GB RAM)

### Symptoms
```bash
# SSH connection hangs
ssh -o ConnectTimeout=10 ubuntu@***.amazonaws.com
# Establishes connection but times out waiting for banner
```

The deploy step hung for 25+ minutes. SSH daemon became unresponsive. System was completely frozen.

### Diagnosis
The deploy script ran:
```bash
docker-compose up --build
```

This triggered Docker to:
1. Run `npm install` for all workspace packages (300+ dependencies)
2. Compile TypeScript for mobile app, server, and shared package
3. Do all of this inside Docker on a t2.micro with only 1GB RAM and **no swap configured**

The kernel OOM killer eventually terminated processes, including the SSH daemon.

Monitoring showed:
```bash
free -h
#               total        used        free
# Mem:          966Mi       954Mi        12Mi
# Swap:            0B          0B          0B
```

### Fix
**Short-term:** Added 2GB swap file to prevent future OOM:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Long-term (proper solution):** Pre-build Docker images in CI, push to Amazon ECR, EC2 just pulls pre-built images:

```yaml
# CI workflow
- name: Build and push Docker images to ECR
  run: |
    # Login to ECR
    aws ecr get-login-password --region us-east-1 | \
      docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.us-east-1.amazonaws.com

    # Build and push
    docker-compose build
    docker-compose push

# EC2 deployment
- name: Pull and restart containers
  run: |
    docker-compose pull
    docker-compose up -d
```

### Lesson
**Never build Docker images on resource-constrained hosts.**

The right architecture:
- **CI runners** (GitHub Actions): 7GB RAM, fast CPU → use for builds
- **Production servers** (t2.micro): 1GB RAM → only pull and run pre-built images

Benefits:
1. Faster deploys (pull is faster than build)
2. No OOM risk on production
3. Consistent builds (same image across environments)
4. Rollback capability (tag images by commit SHA)

This pattern applies to any build-heavy process (Go compilation, webpack, etc.) on small instances.

---

## 4. Dynamic SSH Allowlisting for CI Deploy

### Symptoms
```
ssh: connect to host ***.amazonaws.com port 22: Connection timed out
```

CI deploy step failed immediately with timeout. Local SSH from developer machine worked fine.

### Diagnosis
EC2 security group only allowed SSH from specific CIDR blocks (developer IPs), not GitHub Actions' dynamic runner IPs.

GitHub Actions runners use a [published range of IP addresses](https://api.github.com/meta), but this range is large (~150 addresses) and changes periodically. Adding all of them to the security group would be a security anti-pattern.

### Fix
Dynamically add/remove SSH access during the workflow:

```yaml
- name: Get runner IP
  id: ip
  run: echo "ipv4=$(curl -s https://api.ipify.org)" >> "$GITHUB_OUTPUT"

- name: Authorize SSH from runner
  run: |
    aws ec2 authorize-security-group-ingress \
      --group-id <security-group-id> \
      --protocol tcp \
      --port 22 \
      --cidr ${{ steps.ip.outputs.ipv4 }}/32

- name: Deploy to EC2
  run: ssh ubuntu@*** './deploy.sh'

- name: Revoke SSH access
  if: always()
  run: |
    aws ec2 revoke-security-group-ingress \
      --group-id <security-group-id> \
      --protocol tcp \
      --port 22 \
      --cidr ${{ steps.ip.outputs.ipv4 }}/32
```

### Lesson
**Use temporary security group rules for CI/CD SSH access, always clean up with `if: always()`.**

Key practices:
1. Use `/32` CIDR for single IP allowlisting
2. Always revoke with `if: always()` so cleanup runs even if deploy fails
3. Consider alternatives to SSH for deployment:
   - AWS Systems Manager Session Manager (no open SSH port needed)
   - AWS CodeDeploy
   - Self-hosted GitHub Actions runner on private subnet

This pattern balances security (no permanent wide-open SSH) with practicality (dynamic CI access).

---

## 5. ECR Permission Gaps

### Symptoms
```
Error: Cannot perform an interactive login from a non TTY device

# Then later:
An error occurred (AccessDeniedException) when calling the CreateRepository operation
```

CI step to push Docker images to ECR failed with permission errors.

### Diagnosis
**Problem 1:** `GetAuthorizationToken` unauthorized
- The IAM user running CI had `AmazonEC2ContainerRegistryPowerUser` policy
- This policy includes push/pull but we were missing `ecr:GetAuthorizationToken` for `docker login`

**Problem 2:** `CreateRepository` denied
- The ECR repository didn't exist yet
- `AmazonEC2ContainerRegistryPowerUser` doesn't include `ecr:CreateRepository`

ECR has a quirk: the "PowerUser" policy is designed for pushing/pulling to **existing** repositories, not creating them. Repo creation is considered an admin task.

### Fix
**For CI (pushing images):**
Created repository manually via CloudShell (root access):
```bash
aws ecr create-repository --repository-name ttt-app
```

Attached a custom policy to the CI IAM user:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

**For EC2 (pulling images):**
Attached `AmazonEC2ContainerRegistryReadOnly` to the EC2 IAM instance profile:
```hcl
# Terraform
resource "aws_iam_role_policy_attachment" "ec2_ecr_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
```

### Lesson
**ECR PowerUser is for push/pull, not repo management. EC2 instances need explicit ECR read permissions via instance profile.**

ECR permission layers:
1. **Repo creation:** Admin task, do manually or via IaC
2. **Push access:** `ecr:GetAuthorizationToken` + `ecr:PutImage`, etc.
3. **Pull access:** `ecr:GetAuthorizationToken` + `ecr:BatchGetImage`

EC2 instances should use IAM roles, not IAM user credentials, for ECR access.

---

## 6. Health Check Through Nginx HTTPS Redirect

### Symptoms
```bash
curl http://localhost/api/health
# Returns: 301 Moved Permanently

# Deploy script treats this as failure
```

The health check in `deploy.sh` returned 301 instead of 200, causing the deployment to fail rollback logic.

### Diagnosis
Nginx configuration:
```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    location /api/health {
        proxy_pass http://localhost:3000;
    }
}
```

The health check script used:
```bash
curl http://localhost/api/health
```

`curl` without `-L` doesn't follow redirects, so it received the 301 response and stopped there.

### Fix
Match the health check protocol to what nginx is actually serving:

```bash
# Use HTTPS, handle self-signed cert, fail on non-2xx
curl -skf https://localhost/api/health

# Flags:
# -s: silent (no progress bar)
# -k: insecure (accept self-signed cert)
# -f: fail on HTTP errors (exit code != 0)
```

### Lesson
**Always match your health check protocol to what nginx is serving.**

Common health check patterns:

| Scenario | Health Check |
|----------|-------------|
| Nginx redirects HTTP → HTTPS | `curl -skf https://localhost/path` |
| Direct backend (no nginx) | `curl -f http://localhost:3000/health` |
| Behind load balancer | Check backend directly, not through LB |
| Startup time needed | Add `sleep 5` or retry logic |

Health checks should:
1. Test the actual path users will hit
2. Handle SSL/redirects appropriately
3. Return non-zero exit code on failure (use `-f` flag)
4. Be fast (no unnecessary redirects)

---

## 7. Docker Container Crash Loop (ERR_MODULE_NOT_FOUND)

### Symptoms
```bash
docker ps
# CONTAINER ID   STATUS
# abc123         Restarting (1) 5 seconds ago

docker logs ttt-app
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/packages/shared/src/constants'
```

Container started, then immediately crashed and entered a restart loop.

### Diagnosis
The error message revealed the problem: Node.js was trying to load **TypeScript source files** (`.../src/constants`) at runtime instead of compiled JavaScript.

Looking at the Docker image:
```bash
# Inside container
ls /app/packages/shared/
# dist/  src/  package.json

# The problem:
node apps/server/dist/index.js
# → requires('@ttt/shared/constants')
# → resolves to /app/packages/shared/src/constants.ts ❌
```

This was an **old locally-built image**. The issue:
1. Old Dockerfile copied both `src/` and `dist/` to production stage
2. `package.json` resolution found `src/` first
3. Node.js can't execute TypeScript at runtime

The new ECR-built image had fixed this by using multi-stage builds:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install
RUN npx turbo build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
# ❌ NO src/ copied to production stage
```

### Fix
Deployed new ECR-built image:
```bash
# Pull fresh image
docker-compose pull

# Restart with new image
docker-compose up -d

# Verify
docker logs ttt-app
# ✓ Server listening on port 3000
```

### Lesson
**Multi-stage Docker builds should only copy compiled artifacts to the production stage. If you see `.ts` imports at runtime, your build stage didn't run or the production stage is copying source.**

Best practices:
1. **Build stage:** Install all deps, compile TypeScript
2. **Production stage:** Copy only `dist/`, `package.json`, and production dependencies
3. **Never copy:** `src/`, `tests/`, `tsconfig.json`, dev dependencies
4. **Verify:** Run a local image before pushing:
   ```bash
   docker build -t test-image .
   docker run -it test-image ls /app
   # Should NOT see src/ folders
   ```

If you see runtime errors about missing `.ts` files, check:
- Is `dist/` being generated? (build step running?)
- Is `src/` being excluded from production stage?
- Does `package.json` point to `dist/`, not `src/`?

This pattern applies to any compiled language in Docker (TypeScript, Go, Rust, Java).

---

## Summary: Key Debugging Strategies

1. **Type System Issues:** When TypeScript widens types unexpectedly, annotate the variable, not the values
2. **Monorepo Builds:** Always build workspace dependencies in topological order
3. **Resource Constraints:** Never run heavy builds on production servers—use CI runners
4. **Dynamic Infrastructure:** Use temporary security rules with cleanup guarantees (`if: always()`)
5. **IAM Permissions:** Separate concerns (admin vs. user vs. service permissions)
6. **Health Checks:** Match the protocol and path that real users will hit
7. **Container Images:** Multi-stage builds should only ship compiled artifacts

The common thread: **verify your assumptions** (type inference, available RAM, current IP, IAM policies, redirect behavior, image contents). When something "should work" but doesn't, the assumption is usually wrong.
