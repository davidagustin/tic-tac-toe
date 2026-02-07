# Interview Study Guide

This wiki is structured as interview prep for walking through the tic-tac-toe project. Each page covers a domain interviewers typically ask about. The goal is to help you articulate **why** you made each decision, what the trade-offs are, and what you would change at scale.

---

## Study Pages

| Page | Interview Topics |
|------|-----------------|
| [Architecture](Architecture.md) | "Walk me through your system design", "Why Redis + PostgreSQL?", "How does your state management work?" |
| [Socket Events](Socket-Events.md) | "How does your real-time system work?", "What happens when a player disconnects?", "How do you prevent cheating?" |
| [Database Schema](Database-Schema.md) | "Walk me through your data model", "Why this schema design?", "Why two databases?" |
| [API Reference](API-Reference.md) | "How does your auth flow work?", "Why JWT over sessions?", "How do you handle OAuth securely?" |
| [Deployment](Deployment.md) | "How do you deploy this?", "What's your CI/CD pipeline?", "How do you manage secrets?" |
| [Build Guide](Build-Guide.md) | "How did you build this?", "What did you tackle first?", "Walk me through your implementation order" |
| [Setup Guide](Setup-Guide.md) | "How do I run this locally?", "Walk me through your dev environment", "How do I deploy this from scratch?" |
| [Debugging Guide](Debugging-Guide.md) | "Tell me about a bug you fixed", "How do you debug real-time issues?", "What's a race condition?" |

---

## Quick-Fire Talking Points

Memorize these. They cover the most common surface-level questions before an interviewer goes deeper.

1. **Turborepo monorepo with 3 workspaces** (mobile, server, shared) -- enforces clean dependency boundaries and code sharing.
2. **Socket.IO for real-time** (not REST polling) -- sub-100ms latency for game moves with automatic reconnection and fallback transports.
3. **Dual storage: Redis for ephemeral state, PostgreSQL for persistent data** -- rooms and active games live in Redis with TTLs; user accounts and completed games live in PostgreSQL.
4. **Shared game logic package** runs on both client (instant UI feedback) and server (authoritative validation) -- same TypeScript, zero drift.
5. **JWT with refresh token rotation** (15-minute access / 7-day refresh) -- stateless auth with compromise mitigation via rotation.
6. **Zustand for state management** (4 stores) -- works outside React components, minimal boilerplate, and each store only triggers re-renders for its subscribers.
7. **Fastify over Express** -- 2-3x faster, built-in schema validation via Zod, first-class TypeScript support.
8. **Guest mode with restrictions** -- guests can play but cannot create rooms, preventing spam without blocking casual users.
9. **Server is the authority** -- re-validates every move even though the client has the same game logic, preventing any client-side tampering.
10. **Infrastructure as code** -- Terraform provisions AWS resources, Docker Compose defines the production stack, and GitHub Actions handles CI/CD with zero manual deployment steps.

---

## How to Use This Guide

- **Before a system design interview:** Read [Architecture](Architecture.md) cover to cover. Practice the "Walk me through" answer out loud.
- **Before a backend/API interview:** Read [Socket Events](Socket-Events.md) and [API Reference](API-Reference.md). Focus on the Q&A sections.
- **Before a data modeling interview:** Read [Database Schema](Database-Schema.md). Be ready to draw the ER diagram on a whiteboard.
- **Before a DevOps/infra interview:** Read [Deployment](Deployment.md). Know the CI/CD pipeline steps cold.
- **Before a "how did you build this" question:** Read [Build Guide](Build-Guide.md). Know the 7 phases and why each depends on the previous.
- **Before a live demo or "show me it running":** Read [Setup Guide](Setup-Guide.md). Be ready to clone, set up, and run the app step by step, and walk through the full user flow.
- **Before a behavioral/debugging interview:** Read [Debugging Guide](Debugging-Guide.md). Practice the bug narrative out loud.
- **For any interview:** Review the Quick-Fire Talking Points above. These are your openers.

---

**Navigation:** Home | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | [API Reference](API-Reference.md) | [Deployment](Deployment.md) | [Build Guide](Build-Guide.md) | [Setup Guide](Setup-Guide.md) | [Debugging Guide](Debugging-Guide.md)
