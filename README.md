# Tic-Tac-Toe

**Real-time multiplayer tic-tac-toe built with Expo, Fastify, and Socket.IO.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-52-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<!-- TODO: Add app screenshots/demo GIF here -->

## Overview

A fullstack mobile game featuring local pass-and-play, real-time online multiplayer with rooms and spectators, lobby chat, guest mode, and Google OAuth -- all running on a Turborepo monorepo with shared game logic. Built as a portfolio piece demonstrating real-time architecture, mobile development, and infrastructure-as-code.

## Features

**Gameplay**
- Local pass-and-play multiplayer on one device
- Online real-time matches via WebSocket
- Rematch system with mark swapping between games
- Forfeit option during active games
- Animated cell placement with spring physics (Reanimated)
- Haptic feedback on moves, resets, and interactions

**Multiplayer**
- Room system with create, join, password protection, and host kick
- Ready-up flow with 3-second countdown before game start
- Spectator mode (up to 8 spectators per room)
- Lobby with room browser and online player count
- Rooms auto-expire after 2 hours

**Social**
- Lobby-wide chat for all connected players
- Per-room chat with rate limiting
- Guest mode with random names (can join rooms, cannot create)
- Crypto donation support (BTC/ETH copy-to-clipboard)

**Authentication**
- Email/password registration with bcrypt hashing
- Google OAuth integration
- JWT auth (15m access + 7d refresh tokens)
- Secure token storage via expo-secure-store

**Infrastructure**
- Game results persisted to PostgreSQL with full move history
- Player stats tracking (wins, losses, draws, rating)
- Docker Compose for local dev and production
- Terraform-managed AWS deployment (EC2 free tier)
- GitHub Actions CI/CD pipeline

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Monorepo | Turborepo 2.0, npm workspaces | Build orchestration, workspace management |
| Mobile | Expo 52, Expo Router 4, React Native 0.76 | Cross-platform app (iOS / Android / Web) |
| Styling | NativeWind 4.1 (Tailwind CSS) | Utility-first styling with dark theme |
| State | Zustand 4.5 | Client-side state management |
| Animation | Reanimated 3.16, expo-haptics | Physics-based animations, tactile feedback |
| Server | Fastify 5 | HTTP API and plugin host |
| Real-time | Socket.IO 4.8 + Redis adapter | WebSocket rooms, events, horizontal scaling |
| Database | PostgreSQL 16, Prisma 5.20 | User accounts, completed game persistence |
| Cache | Redis 7, ioredis | Ephemeral state (rooms, presence, chat) |
| Auth | @fastify/jwt, bcryptjs, google-auth-library | JWT tokens, password hashing, OAuth |
| Validation | Zod 3.23 | Runtime schema validation |
| Quality | Biome 2.3, TypeScript strict, Vitest, Husky | Linting, formatting, testing, pre-commit hooks |
| Infra | Docker, Terraform, Nginx, GitHub Actions | Containerization, IaC, reverse proxy, CI/CD |

## Architecture

```
                         +-----------+
                         |   Mobile  |
                         |  (Expo)   |
                         +-----+-----+
                               |
                    Socket.IO / HTTP
                               |
                         +-----v-----+
                   +---->|   Nginx   |<----+
                   |     | (reverse  |     |
                   |     |  proxy)   |     |
                   |     +-----+-----+     |
                   |           |           |
              WebSocket    REST API    Static
                   |           |           |
                   +-----+-----+-----------+
                         |
                   +-----v-----+
                   |  Fastify  |
                   |  Server   |
                   +--+-----+--+
                      |     |
             +--------+     +--------+
             |                       |
       +-----v-----+          +-----v-----+
       |   Redis    |          | PostgreSQL|
       | (ephemeral)|          |(persistent)|
       +-----------+          +-----------+
        - Active rooms         - User accounts
        - Game state           - Completed games
        - Presence             - Move history
        - Chat messages        - Player stats
        - Room TTLs            - OAuth accounts
```

**Dual-storage pattern:** Redis handles all ephemeral, real-time state (active rooms, in-progress games, player presence, chat). PostgreSQL stores only persistent data (user accounts, completed game results with full move history, player statistics). Guest-only games are not persisted. This separation keeps real-time operations fast while maintaining a durable record of meaningful data.

## Project Structure

```
tic-tac-toe/
├── apps/
│   ├── mobile/                # Expo React Native app
│   │   ├── app/               #   Expo Router screens (file-based routing)
│   │   ├── components/        #   Reusable UI components
│   │   ├── hooks/             #   Socket.IO listeners (useLobby, useRoom)
│   │   ├── services/          #   API client, Socket.IO singleton
│   │   └── stores/            #   Zustand stores (auth, lobby, room, game)
│   └── server/                # Fastify API + Socket.IO server
│       ├── prisma/            #   Schema, migrations, seed
│       ├── src/
│       │   ├── handlers/      #   Socket.IO event handlers (lobby, room, game)
│       │   ├── plugins/       #   Fastify plugins (CORS, JWT, Socket.IO)
│       │   ├── routes/        #   HTTP routes (auth, health)
│       │   ├── services/      #   Business logic (room, game, chat, auth)
│       │   └── lib/           #   Redis client, utilities
│       └── Dockerfile         #   Multi-stage production build
├── packages/
│   └── shared/                # @ttt/shared - shared across all apps
│       └── src/
│           ├── gameLogic.ts   #   Win detection, move validation
│           ├── types.ts       #   Socket.IO event maps, room/chat types
│           ├── constants.ts   #   Room config, chat config, Redis keys
│           └── __tests__/     #   Vitest unit tests (14 tests)
├── infra/
│   └── terraform/             # AWS infrastructure (EC2, SSM, security groups)
├── nginx/                     # Reverse proxy config + SSL termination
├── .github/workflows/         # CI/CD pipeline (test, build, deploy)
├── docker-compose.yml         # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml    # Prod: App + PostgreSQL + Redis + Nginx
└── turbo.json                 # Turborepo pipeline configuration
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Docker** and **Docker Compose**
- **Expo CLI** (`npx expo`)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/tic-tac-toe.git
cd tic-tac-toe

# Install dependencies
npm install

# Start PostgreSQL and Redis
docker compose up -d

# Configure environment
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your secrets

# Run database migrations
npm run -w @ttt/server db:migrate

# Start all workspaces in dev mode
npm run dev
```

The server runs on `http://localhost:3001` and the Expo dev server starts for mobile.

## Environment Variables

Create `apps/server/.env` from the example file. All variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ttt_user:ttt_password@localhost:5432/ttt_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Access token signing secret | (min 16 characters) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | (min 16 characters) |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (from Google Cloud Console) |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | `http://localhost:3001/api/auth/google/callback` |

## Available Scripts

Run from the repository root:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all workspaces in development mode |
| `npm run build` | Build all workspaces |
| `npm run lint` | TypeScript type-check all workspaces |
| `npm run test` | Run all tests (Vitest) |
| `npm run lint:biome` | Lint with Biome |
| `npm run format` | Auto-format with Biome |
| `npm run validate` | Full validation (TypeScript + Biome) |

## Testing

Tests live in `packages/shared` and cover game logic (win detection, move validation, draw detection, board state management).

```bash
# Run all tests
npm run test

# Run shared package tests directly
npm run -w @ttt/shared test
```

## Deployment

The project deploys to AWS using a fully automated pipeline:

1. **GitHub Actions** runs tests, lint, and build on every push
2. **Docker** multi-stage build creates an optimized production image
3. **Terraform** provisions EC2 (t2.micro free tier), security groups, and SSM parameters
4. **Nginx** handles SSL termination and WebSocket proxying
5. **Docker Compose** orchestrates the production stack (app + PostgreSQL + Redis + Nginx)

Infrastructure configuration lives in `infra/terraform/`. Production secrets are stored in AWS SSM Parameter Store.

## License

MIT
