# Deployment -- Interview Study Guide

---

## "How Do You Deploy This?"

This is the answer to give when an interviewer asks about your deployment process.

The entire infrastructure is provisioned with **Terraform**: an EC2 t2.micro instance (free tier), an Elastic IP, security groups, an IAM role with SSM access, and all application secrets generated and stored in **SSM Parameter Store**. I run `terraform apply` once to create everything, and infrastructure changes go through the same Terraform workflow.

The application runs as a **Docker Compose stack** on the EC2 instance: four containers (app, PostgreSQL, Redis, Nginx). The server application is built with a **multi-stage Dockerfile** that produces a minimal production image -- the build stage compiles TypeScript across all three workspaces (shared, server, mobile), and the production stage copies only the compiled output and production `node_modules`. This cuts the image size by ~60%.

Deployment is fully automated via **GitHub Actions**. On every push to `main`, the CI pipeline runs three jobs sequentially: **test** (type-check + unit tests for shared and server packages), **build** (verify Docker image builds), and **deploy** (build + tag with commit SHA, push to ECR, SSH to EC2, pull and restart). The deploy job is the interesting part -- it dynamically opens SSH access for the GitHub Actions runner's ephemeral IP, deploys, and then **always** closes the SSH rule, even if the deploy fails.

Nginx sits in front as a **reverse proxy** handling SSL termination (Let's Encrypt), HTTP-to-HTTPS redirects, WebSocket upgrade for Socket.IO, and basic rate limiting. All external traffic enters through Nginx on ports 80/443; the app, PostgreSQL, and Redis are only accessible on the Docker internal network.

---

## Infrastructure Decisions

### Q: "Why EC2 over ECS/Fargate or Lambda?"

I chose EC2 t2.micro because it is **free tier eligible** for 12 months, and WebSocket connections require persistent servers. Lambda has a 15-minute execution timeout and API Gateway WebSocket has per-message pricing that adds up with real-time games. ECS Fargate would work well but adds complexity (task definitions, service discovery, ALB) that is unnecessary for a single-instance deployment.

**Trade-off:** EC2 requires manual server management (OS updates, monitoring, disk space). ECS/Fargate abstracts this away. For a portfolio project, the learning value of managing the full stack outweighs the operational overhead.

**At scale:** I would move to **ECS Fargate** with auto-scaling policies based on active WebSocket connection count, or **EKS** if the team already uses Kubernetes. The Dockerized setup makes this migration straightforward -- the same Docker image runs in any container orchestrator.

---

### Q: "Why SSM Parameter Store over Secrets Manager?"

SSM Parameter Store is **free**. Secrets Manager costs $0.40 per secret per month. Both support KMS encryption (SecureString parameters in SSM are encrypted at rest). For a portfolio project with ~13 secrets, Secrets Manager would cost ~$5/month for no additional benefit.

**Trade-off:** Secrets Manager offers automatic secret rotation (e.g., rotate a database password on a schedule). SSM does not. If I needed rotation, I would use Secrets Manager for the rotating secrets and SSM for everything else.

**At scale:** I would still use SSM for static configuration and add Secrets Manager for secrets that need automatic rotation (database passwords, API keys for third-party services).

---

### Q: "Why Terraform over CloudFormation or CDK?"

Terraform is **cloud-agnostic** -- the skills transfer to GCP, Azure, or any provider with a Terraform provider. CloudFormation is AWS-only. CDK would also work (and generates CloudFormation under the hood), but Terraform's HCL syntax is more readable than TypeScript/Python CDK constructs for infrastructure definitions, and the Terraform community is larger.

**Trade-off:** Terraform requires managing state files (I store `terraform.tfstate` locally; in a team, it would go in an S3 backend with DynamoDB locking). CloudFormation manages state automatically via the AWS control plane.

**At scale:** Terraform with a **remote S3 backend**, state locking via DynamoDB, and **Terraform workspaces** for environment separation (dev, staging, prod).

---

### Q: "How do you manage secrets in CI/CD?"

Three layers of secret management, none of which involve hardcoded values:

1. **GitHub Secrets** for CI/CD credentials (AWS keys, EC2 host, SSH key, security group ID). These are injected as environment variables in GitHub Actions workflows.
2. **SSM Parameter Store** for application secrets on EC2 (database credentials, JWT secrets, Redis password, OAuth credentials). The EC2 instance's IAM role grants access to these parameters.
3. **Terraform auto-generates** database, Redis, and JWT passwords (32-64 random characters) and stores them in SSM. No human ever sees or types these passwords.

**Key point:** No secrets exist in code, Docker images, or git history. The Docker Compose file reads secrets from SSM at container startup via an init script.

---

### Q: "What is the dynamic SSH trick in your CI/CD?"

GitHub Actions runners have **ephemeral IP addresses** that change on every run. My security group only allows SSH from specific IPs. The deploy job handles this:

1. Fetch the runner's public IP via `api.ipify.org`.
2. Add a **temporary security group ingress rule** allowing SSH (port 22) from that IP.
3. SSH to EC2 and run the deploy script.
4. **Always** remove the temporary SSH rule -- this runs in a cleanup step that executes even if the deploy fails.

Without this, I would need to either leave SSH open to the internet (insecure) or manually update the security group before each deploy (defeats automation). This approach gives me **zero-trust SSH access** that exists only for the ~60 seconds of deployment.

**Trade-off:** If the cleanup step fails (extremely rare -- GitHub Actions has robust job lifecycle management), the SSH rule persists. I could add a cron job or Lambda to audit and remove stale rules as a safety net.

---

## Docker Production Stack

Four containers defined in `docker-compose.prod.yml`:

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `app` | Multi-stage build from `apps/server/Dockerfile` | 3001 (internal only) | Node.js Fastify server |
| `postgres` | `postgres:16-alpine` | 5432 (internal only) | Persistent data (users, games, tokens) |
| `redis` | `redis:7-alpine` | 6379 (internal only) | Ephemeral state + Socket.IO pub/sub |
| `nginx` | Custom from `nginx/Dockerfile` | 80, 443 (public) | SSL termination, reverse proxy, rate limiting |

### Why Multi-Stage Build?

The Dockerfile has two stages:

1. **Build stage**: Installs all dependencies (including devDependencies), compiles TypeScript across shared and server packages, generates the Prisma client.
2. **Production stage**: Copies only compiled JavaScript and production `node_modules`. Runs as a non-root user.

This produces an image that is **~60% smaller** than a single-stage build, has no TypeScript compiler or dev tools (smaller attack surface), and runs with least-privilege (non-root).

### Health Checks and Dependency Order

```
nginx --> app --> postgres (healthy)
               --> redis (healthy)
```

Both PostgreSQL and Redis have health check commands (`pg_isready` and `redis-cli ping`) that run every 5 seconds. The app container does not start until both are healthy. Nginx depends on app. This prevents the app from crashing on startup due to database unavailability.

### Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_data` | PostgreSQL data survives container restarts |
| `redis_data` | Redis AOF persistence survives container restarts |
| `certbot_webroot` | Let's Encrypt ACME challenge files for cert renewal |

---

## CI/CD Pipeline

```
Push/PR to main
       |
       v
   [Test Job] -- type-check shared, run vitest, build shared, prisma generate, type-check server
       |
       v
   [Build Job] -- docker build (verify image compiles)
       |
       v (main branch push only, not PRs)
   [Deploy Job] -- build+push to ECR, dynamic SSH, deploy.sh, revoke SSH
```

### Key details:

- **Test job** catches TypeScript errors and failing tests before anything is built.
- **Build job** catches Docker-specific issues (missing files, bad COPY paths) that the test job would not find.
- **Deploy job** only runs on pushes to `main`, not on PRs. This prevents accidental deployments from feature branches.
- The deploy script on EC2 (`~/app/scripts/deploy.sh`) pulls the new image from ECR, runs database migrations, and restarts the Docker Compose stack.

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user for ECR push and EC2 SSH rule management |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | Region for ECR and EC2 |
| `AWS_ACCOUNT_ID` | ECR registry URL construction |
| `EC2_HOST` | Elastic IP for SSH |
| `EC2_SSH_KEY` | Private key for SSH access |
| `EC2_SG_ID` | Security group for dynamic SSH rule |

---

## Nginx Configuration

| Feature | Implementation |
|---------|---------------|
| SSL termination | Let's Encrypt certs, HTTP-to-HTTPS redirect |
| Reverse proxy | All `/api/*` traffic proxied to app:3001 |
| WebSocket proxy | `/api/socket.io/` path with `Upgrade` and `Connection` headers |
| Rate limiting | 10 req/s burst for API endpoints |
| ACME challenge | `/.well-known/acme-challenge/` path exception for cert renewal |

**Why Nginx in front of Fastify?** Nginx handles SSL termination more efficiently than Node.js (written in C, optimized for TLS). It also provides a centralized point for rate limiting, request buffering, and static file serving if needed.

---

## At Scale

| Current | At Scale |
|---------|----------|
| Single EC2 t2.micro | **ECS Fargate** with auto-scaling (2-10 tasks based on connection count) |
| Docker Compose on EC2 | **ECS Service** with task definitions, or **EKS** for Kubernetes |
| Self-managed PostgreSQL | **RDS Multi-AZ** with automated backups, point-in-time recovery |
| Self-managed Redis | **ElastiCache Redis** with Multi-AZ failover |
| Nginx on EC2 | **Application Load Balancer** with sticky sessions for Socket.IO |
| Let's Encrypt manual | **ACM** (AWS Certificate Manager) for free, auto-renewing certs on ALB |
| Single environment | **Staging environment** with identical infrastructure (Terraform workspaces) |
| Rolling deploys (brief downtime) | **Blue/green deployments** via ECS with zero downtime |
| No CDN | **CloudFront** for static assets and API caching |
| Logs in Docker | **CloudWatch Logs** with structured JSON logging, alerting on error rates |
| No monitoring | **CloudWatch metrics** + **OpenTelemetry** for distributed tracing |

### Key Talking Point

The current infrastructure is intentionally minimal (free tier, single instance) but the architecture is production-ready. Moving to managed services (RDS, ElastiCache, ECS, ALB) is a configuration change -- the application code, Docker image, and CI/CD pipeline all transfer directly.

---

## Key Talking Points Summary

- **Infrastructure as code**: Terraform provisions everything, including auto-generated secrets.
- **Zero-trust SSH**: Dynamic security group rules scoped to the CI runner's IP and auto-removed.
- **Multi-stage Docker**: 60% smaller image, no dev tools, non-root user.
- **Health check ordering**: App waits for healthy database and Redis before starting.
- **SSM over Secrets Manager**: Free tier, same KMS encryption.
- **CI/CD pipeline**: Test, build, deploy -- deploy only on main branch pushes.
- **Scale path is clear**: Same Docker image runs on ECS/EKS; same Terraform patterns apply to RDS/ElastiCache.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | Deployment
