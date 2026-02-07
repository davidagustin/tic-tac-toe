# API Reference -- Interview Study Guide

---

## "How Does Your Auth Flow Work?"

This is the answer to give when an interviewer asks about authentication.

A user registers by sending their email, password, and display name to `POST /api/auth/register`. The server validates the input with a **Zod schema**, hashes the password with **bcrypt** (12 rounds), and creates the user in PostgreSQL. It then generates a **JWT access token** (15-minute expiry, contains userId and email) and a **refresh token** (random 64 bytes, hashed with SHA-256 and stored in the database with a 7-day expiry). Both tokens are returned in the response body, and the refresh token is also set as an **httpOnly cookie** for automatic inclusion in subsequent requests.

The client stores the access token in **expo-secure-store** (encrypted on-device storage) and uses it for two things: the `Authorization: Bearer` header on REST requests, and the `handshake.auth.token` field when establishing a Socket.IO connection. The server validates the JWT on every REST request (via Fastify's `onRequest` hook) and on every Socket.IO connection (via middleware).

When the access token expires after 15 minutes, the client sends the refresh token to `POST /api/auth/refresh`. The server hashes the received token, looks it up in the database, **deletes the old hash** (revocation), generates a new token pair, and returns them. This is **refresh token rotation** -- each refresh token can only be used once, which limits the damage if one is stolen.

For **Google OAuth**, the flow adds a layer: the client opens a browser to `GET /api/auth/google`, which redirects to Google's consent screen with a **CSRF state parameter** (random 32 bytes, 5-minute TTL stored in Redis). Google calls back with an authorization code, the server exchanges it for user info, creates or links the account, generates a **temporary auth code** (60-second TTL), and redirects the mobile app via deep link. The app exchanges this code for JWT tokens via `POST /api/auth/oauth/exchange`.

---

## Auth Design Decisions

### Q: "Why JWT over sessions?"

I chose JWTs because they are **stateless** -- no server-side session store is needed. This matters for two reasons: (1) it works naturally with Socket.IO, where the token is passed once in the handshake rather than requiring a session lookup on every event, and (2) it simplifies horizontal scaling because any server instance can validate the token independently.

**Trade-off:** You cannot immediately revoke an access token. If a user's account is compromised, the attacker has access until the token expires. I mitigate this with a **short 15-minute lifetime** -- the blast radius of a stolen access token is small.

**At scale:** I would add a **Redis-backed token blacklist** for immediate revocation (check the blacklist on each request, with the blacklist entry TTL matching the token's remaining lifetime). This adds a Redis lookup per request but gives instant revocation capability.

---

### Q: "Why bcrypt over Argon2?"

bcrypt is battle-tested (25+ years), has excellent library support (`bcryptjs` is pure JavaScript with no native compilation dependencies), and 12 rounds provides ~250ms hash time -- sufficient to make brute-force attacks impractical. Argon2 is theoretically stronger (memory-hard, resistant to GPU attacks), but it requires native C bindings, which complicates Docker builds and cross-platform compatibility.

**Trade-off:** bcrypt is not memory-hard, so it is more vulnerable to GPU-based attacks than Argon2. For a tic-tac-toe game, this threat model is not realistic. For a banking app, I would choose Argon2.

**At scale:** Still bcrypt. The library choice does not change with scale -- what changes is adding **rate limiting on login attempts** (already in place: 5 requests/minute per client) and **account lockout after N failures**.

---

### Q: "How do you handle OAuth securely?"

Three protections:

1. **CSRF state parameter**: A random 32-byte string is generated, stored in Redis with a 5-minute TTL, and included in the OAuth redirect URL. When Google calls back, the server verifies the state matches. This prevents an attacker from tricking a user into linking the attacker's Google account.

2. **Temporary auth code**: After OAuth completes, the server does not return JWTs in the redirect URL (which could be intercepted). Instead, it generates a short-lived code (60-second TTL in Redis) and redirects with just that code. The client exchanges it for tokens via a separate POST request.

3. **Server-side token exchange**: The authorization code from Google is exchanged for Google tokens on the server, never on the client. The client never sees Google's access token.

**Trade-off:** The two-step exchange (redirect with code, then POST for tokens) adds a round-trip. This is a security-for-latency trade-off that is standard practice.

**At scale:** I would add **PKCE** (Proof Key for Code Exchange) for the mobile client, which prevents authorization code interception even if the redirect is compromised.

---

### Q: "What happens if someone steals a refresh token?"

Refresh tokens are **rotated on each use**. When a legitimate user refreshes, the old token's hash is deleted from the database and a new one is created. If an attacker stole the token:

- **Attacker uses it first:** They get new tokens. When the legitimate user tries to refresh, their token is invalid (already rotated). This signals compromise -- the user must re-authenticate.
- **Legitimate user uses it first:** The attacker's stolen token is invalid (already rotated). The attack fails silently.

In both cases, the damage is limited. The attacker gets at most one token pair (15-minute access + one refresh). A more sophisticated system would detect the reuse of a rotated token and revoke **all** of that user's refresh tokens (token family revocation).

---

### Q: "Why httpOnly cookies for refresh tokens?"

An httpOnly cookie **cannot be read by JavaScript** (no `document.cookie` access). This protects against XSS attacks -- even if an attacker injects script into the page, they cannot steal the refresh token. The cookie is also scoped to the `/api/auth` path and marked `secure` in production (HTTPS only).

**Trade-off:** Cookies are sent automatically on every request to the matching path, which means CSRF protection is needed. For the refresh endpoint, this is mitigated by also accepting the token in the request body (the mobile client sends it explicitly, not via cookie).

---

## Endpoint Reference

### Health

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | None | Returns `200` if database is reachable, `503` if not |

### Authentication

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | None | Create account. Returns tokens + user profile. |
| POST | `/api/auth/login` | None | Authenticate with email/password. Returns tokens + user. |
| POST | `/api/auth/refresh` | Refresh token (body or cookie) | Rotate refresh token, get new access token. |
| POST | `/api/auth/logout` | Refresh token cookie | Revoke refresh token, clear cookie. |
| GET | `/api/auth/me` | JWT Bearer | Get current user profile and stats. |

### OAuth (Google)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/google` | None | Redirect to Google consent screen with CSRF state. |
| GET | `/api/auth/google/callback` | None (from Google) | Handle callback, create/link user, redirect with temp code. |
| POST | `/api/auth/oauth/exchange` | None | Exchange temp auth code for JWT tokens. |

### Input Validation

All endpoints validate input with **Zod schemas**. Invalid input returns `400` with field-level error details:

```json
{
  "success": false,
  "error": "Invalid input",
  "details": {
    "email": "Invalid email format",
    "password": "Must be at least 8 characters"
  }
}
```

### Rate Limiting

Auth endpoints are rate-limited to **5 requests per minute** per client IP. This prevents brute-force attacks on login and credential stuffing.

---

## JWT Token Details

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| Expiry | 15 minutes | 7 days |
| Payload | `{ userId, email }` | Random 64 bytes |
| Storage (client) | expo-secure-store | httpOnly cookie + secure store |
| Storage (server) | Stateless (verified by signature) | SHA-256 hash in PostgreSQL |
| Rotation | New one on each refresh | Rotated on each use (old revoked) |

**Key talking point:** Access tokens are stateless (no database lookup to validate). Refresh tokens are stateful (must exist in the database). This gives the best of both worlds: fast validation for frequent operations, secure rotation for infrequent token refreshes.

---

## At Scale

| Current | At Scale |
|---------|----------|
| No access token revocation | **Redis token blacklist** with TTL matching remaining token lifetime |
| Global rate limit (5/min for auth) | **Per-endpoint rate limits** (stricter on login, relaxed on profile read) |
| Basic CSRF state for OAuth | **PKCE flow** for mobile (more secure than implicit grant) |
| Single JWT signing key | **Key rotation** with JWKS endpoint (allows zero-downtime key changes) |
| No account lockout | **Progressive lockout** (increasing delay after N failed login attempts) |
| Refresh tokens in PostgreSQL | Still fine at scale -- writes are infrequent (1 per 15-min refresh per active user) |

---

## Key Talking Points Summary

- **Stateless access tokens** for speed, **stateful refresh tokens** for security.
- **Refresh token rotation** limits damage from token theft.
- **bcrypt with 12 rounds** balances security and performance.
- **OAuth CSRF protection** via random state parameter with Redis TTL.
- **Temporary auth codes** avoid exposing JWTs in redirect URLs.
- **httpOnly cookies** protect refresh tokens from XSS.
- **Zod validation** on every endpoint ensures malformed input never reaches business logic.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | API Reference | [Deployment](Deployment.md)
