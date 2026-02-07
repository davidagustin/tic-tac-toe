// ─── Socket Event Names ────────────────────────────────

export const SOCKET_EVENTS = {
  GAME_MOVE: 'game:move',
  GAME_STATE: 'game:state',
  GAME_MOVED: 'game:moved',
  GAME_OVER: 'game:over',
  GAME_FORFEIT: 'game:forfeit',
  GAME_REMATCH: 'game:rematch',
  GAME_OPPONENT_DISCONNECTED: 'game:opponent_disconnected',
  MATCHMAKING_JOIN: 'matchmaking:join',
  MATCHMAKING_LEAVE: 'matchmaking:leave',
  MATCHMAKING_FOUND: 'matchmaking:found',
  MATCHMAKING_WAITING: 'matchmaking:waiting',
  ERROR: 'error',
} as const;

// ─── Game Config ───────────────────────────────────────

export const GAME_CONFIG = {
  DISCONNECT_TIMEOUT_SECONDS: 30,
  GAME_TTL_SECONDS: 3600,           // 1 hour
  MAX_MATCHMAKING_WAIT_SECONDS: 60,
  INITIAL_RATING: 1000,
  RATING_K_FACTOR: 32,
} as const;

// ─── API Routes ────────────────────────────────────────

export const API_ROUTES = {
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    GOOGLE: '/api/auth/google',
    GITHUB: '/api/auth/github',
  },
  USER: {
    PROFILE: '/api/user/profile',
    STATS: '/api/user/stats',
    LEADERBOARD: '/api/user/leaderboard',
  },
  GAME: {
    HISTORY: '/api/game/history',
    DETAIL: '/api/game/:id',
  },
  HEALTH: '/api/health',
} as const;
