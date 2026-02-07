# Tic-Tac-Toe Online - Wiki

Welcome to the **Tic-Tac-Toe Online** project wiki. This is a real-time multiplayer tic-tac-toe game built as a fullstack TypeScript monorepo with an Expo mobile app, Fastify server, and shared game logic package.

## Quick Links

| Page | Description |
|------|-------------|
| [Architecture](Architecture.md) | System overview, dual-storage pattern, real-time architecture, room lifecycle, game engine, and state management |
| [Socket Events](Socket-Events.md) | Complete reference for all Socket.IO client-to-server and server-to-client events |
| [Database Schema](Database-Schema.md) | Prisma models (User, Account, Game, Move, RefreshToken) and Redis data structures |
| [API Reference](API-Reference.md) | REST API endpoints for authentication, OAuth, and health checks |
| [Deployment](Deployment.md) | Terraform infrastructure, Docker production stack, CI/CD pipeline, and SSL setup |

## Project Structure

```
tic-tac-toe/
  apps/
    mobile/          # Expo 52 + Expo Router 4 + NativeWind + Zustand
    server/          # Fastify 5 + Socket.IO + Prisma + Redis
  packages/
    shared/          # @ttt/shared - game logic, types, constants
  infra/
    terraform/       # AWS EC2 + SSM + IAM via Terraform
  nginx/             # Reverse proxy + SSL termination
  .github/
    workflows/       # CI/CD pipeline (test, build, deploy)
```

## Tech Stack at a Glance

| Layer | Technology |
|-------|------------|
| Mobile | Expo 52, Expo Router 4, NativeWind, Zustand, Reanimated, socket.io-client |
| Server | Fastify 5, Socket.IO 4.8.3, Prisma 5.20, ioredis, @fastify/jwt, Zod |
| Shared | TypeScript game logic, typed Socket.IO events, constants |
| Database | PostgreSQL 16 (persistent), Redis 7 (ephemeral) |
| Infra | AWS EC2 t2.micro, Terraform, Docker Compose, Nginx, Let's Encrypt |
| CI/CD | GitHub Actions (test, Docker build, ECR push, SSH deploy) |
| Tooling | Turborepo, Biome, Husky, lint-staged |

## Design Highlights

- **Dark theme**: background `#0a0a0a`, X = blue `#3b82f6`, O = rose `#f43f5e`, accent = purple `#8b5cf6`
- **Guest mode**: Play without registration; guests can join rooms but cannot create them
- **Shared game logic**: Win detection, move validation, and board state computed in `@ttt/shared`, used by both client and server
- **Real-time**: Socket.IO with Redis adapter for horizontal scaling
- **Security**: SSM Parameter Store for secrets, Zod validation on all inputs, bcrypt password hashing, JWT with refresh token rotation
