# REST API Reference

All REST endpoints are served by the Fastify 5 server. Base path: `/api`. Input validation uses Zod schemas. All responses follow the `ApiResponse<T>` shape.

## Response Format

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  details?: object;  // field-level validation errors (on 400)
}
```

---

## Health Check

### `GET /api/health`

Check server and database connectivity.

**Authentication:** None

**Response:**

| Status | Body | Condition |
|--------|------|-----------|
| `200` | `{ "status": "ok" }` | Database is reachable |
| `503` | `{ "status": "error", "message": "Database connection failed" }` | Database query failed |

---

## Authentication

All auth endpoints are rate-limited to **5 requests per minute** per client.

### `POST /api/auth/register`

Create a new user account.

**Authentication:** None

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `email` | `string` | Valid email format | User email (stored lowercase) |
| `password` | `string` | 8-128 characters | Plain text password (hashed with bcrypt, 12 rounds) |
| `name` | `string` | 1-50 characters | Display name (must be unique, case-insensitive) |

**Success Response (`201`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "a1b2c3...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "Alice",
      "rating": 1000,
      "avatarUrl": null,
      "stats": {
        "gamesPlayed": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0
      }
    }
  }
}
```

**Also sets:** `refreshToken` as an httpOnly cookie (path: `/api/auth`, max-age: 7 days, secure in production).

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| `400` | `"Invalid input"` | Zod validation failed (details in `details` field) |
| `409` | `"An account with this email already exists"` | Email already registered |
| `409` | `"Screen name is already taken"` | Display name taken (case-insensitive) |

---

### `POST /api/auth/login`

Authenticate with email and password.

**Authentication:** None

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | User email |
| `password` | `string` | Plain text password |

**Success Response (`200`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "a1b2c3...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "Alice",
      "rating": 1200,
      "avatarUrl": null,
      "stats": {
        "gamesPlayed": 15,
        "wins": 8,
        "losses": 5,
        "draws": 2
      }
    }
  }
}
```

**Also sets:** `refreshToken` httpOnly cookie.

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| `400` | `"Invalid input"` | Zod validation failed |
| `401` | `"Invalid email or password"` | Email not found, no password hash (OAuth-only), or wrong password |

---

### `POST /api/auth/refresh`

Rotate the refresh token and get a new access token.

**Authentication:** None (uses refresh token)

**Request Body (or Cookie):**

The refresh token can be provided in either:
- The request body: `{ "refreshToken": "a1b2c3..." }`
- The `refreshToken` httpOnly cookie (set by login/register)

**Success Response (`200`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "d4e5f6..."
  }
}
```

**Token Rotation:** The old refresh token is revoked (deleted from DB) and a new one is issued. This prevents token reuse.

**Also sets:** New `refreshToken` httpOnly cookie.

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| `401` | `"No refresh token"` | Neither body nor cookie contained a token |
| `401` | `"Invalid or expired refresh token"` | Token not found in DB or expired |

---

### `POST /api/auth/logout`

Invalidate the current refresh token and clear the cookie.

**Authentication:** None (uses refresh token cookie)

**Success Response (`200`):**

```json
{
  "success": true
}
```

Clears the `refreshToken` cookie and deletes the token hash from the database.

---

### `GET /api/auth/me`

Get the current authenticated user's profile.

**Authentication:** Required (JWT Bearer token)

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Success Response (`200`):**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "Alice",
    "rating": 1200,
    "avatarUrl": "https://...",
    "stats": {
      "gamesPlayed": 15,
      "wins": 8,
      "losses": 5,
      "draws": 2
    }
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | `"User not found"` | User ID from token not in database |

---

## OAuth

### `GET /api/auth/google`

Initiate Google OAuth flow. Redirects the user to Google's consent screen.

**Authentication:** None

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `platform` | `string?` | Set to `"web"` for web app callback redirect. Otherwise defaults to mobile deep link. |

**Flow:**
1. Generates a CSRF state parameter (random 32 bytes, 5-minute TTL)
2. Redirects to Google OAuth consent screen with scopes: `openid`, `email`, `profile`

---

### `GET /api/auth/google/callback`

Google OAuth callback. Called by Google after user consents.

**Authentication:** None (handled by Google)

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `code` | `string` | Authorization code from Google |
| `state` | `string` | CSRF state parameter for validation |

**Flow:**
1. Validates CSRF state parameter
2. Exchanges authorization code for Google tokens
3. Verifies ID token and extracts user info (email, name, picture)
4. Finds or creates user (links Google account if user exists)
5. Generates a temporary auth code (60-second TTL)
6. Redirects:
   - **Mobile:** `tictactoe://auth/callback?code={authCode}`
   - **Web:** `{origin}/auth/callback?code={authCode}`

---

### `POST /api/auth/oauth/exchange`

Exchange a temporary OAuth auth code for JWT tokens.

**Authentication:** None

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Temporary auth code from OAuth callback redirect |

**Success Response (`200`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "a1b2c3..."
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| `400` | `"Authorization code required"` | Missing code |
| `401` | `"Invalid or expired authorization code"` | Code not found or expired (60s TTL) |

---

## JWT Token Details

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| **Expiry** | 15 minutes | 7 days |
| **Payload** | `{ userId, email }` | Random 64 bytes (stored as SHA-256 hash) |
| **Storage** | Client memory / secure storage | httpOnly cookie + response body |
| **Rotation** | New one on each refresh | Rotated on each refresh (old revoked) |

---

## API Routes Constants

Defined in `packages/shared/src/constants.ts` as `API_ROUTES`:

```typescript
{
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN:    "/api/auth/login",
    REFRESH:  "/api/auth/refresh",
    LOGOUT:   "/api/auth/logout",
    GOOGLE:   "/api/auth/google",
    GITHUB:   "/api/auth/github",
  },
  USER: {
    PROFILE:     "/api/user/profile",
    STATS:       "/api/user/stats",
    LEADERBOARD: "/api/user/leaderboard",
  },
  GAME: {
    HISTORY: "/api/game/history",
    DETAIL:  "/api/game/:id",
  },
  HEALTH: "/api/health",
}
```

**Note:** Some routes defined in constants (User, Game) are planned but not yet implemented. Currently implemented routes are documented above.

---

**Navigation:** [Home](Home.md) | [Architecture](Architecture.md) | [Socket Events](Socket-Events.md) | [Database Schema](Database-Schema.md) | API Reference | [Deployment](Deployment.md)
