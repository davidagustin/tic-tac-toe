import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "../config/api";

const isWeb = Platform.OS === "web";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: isWeb, // Send cookies automatically on web
});

// ─── Token Storage (platform-aware) ────────────────
// Native: SecureStore (encrypted keychain)
// Web: httpOnly cookies handle storage; keep access token
//      in memory only for Socket.IO which can't use cookies.

let inMemoryAccessToken: string | null = null;

async function setItem(key: string, value: string) {
  if (isWeb) {
    // Web: don't use localStorage for tokens — cookies handle it
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (isWeb) {
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(accessToken: string, refreshToken?: string) {
  if (isWeb) {
    // Web: cookies are set by the server; keep access token in memory for Socket.IO
    inMemoryAccessToken = accessToken;
    return;
  }
  // Native: store in SecureStore
  await setItem("accessToken", accessToken);
  if (refreshToken) {
    await setItem("refreshToken", refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) {
    return inMemoryAccessToken;
  }
  return getItem("accessToken");
}

export async function clearTokens() {
  if (isWeb) {
    inMemoryAccessToken = null;
    return;
  }
  await deleteItem("accessToken");
  await deleteItem("refreshToken");
}

// ─── Web Cookie Helpers ───────────────────────────────

function getCookie(name: string): string | null {
  if (!isWeb) return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

// ─── API Interceptor (auto-refresh) ────────────────

api.interceptors.request.use(async (config) => {
  if (isWeb) {
    // Web: cookies sent automatically; add CSRF header for mutations
    if (config.method !== "get") {
      const csrfToken = getCookie("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
  } else {
    // Native: send access token as Bearer header
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (isWeb) {
          // Web: refresh token is in httpOnly cookie, sent automatically
          const { data } = await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { withCredentials: true },
          );

          if (data.success) {
            // Server sets new cookies; keep access token in memory for Socket.IO
            inMemoryAccessToken = data.data.accessToken;
            return api(originalRequest);
          }
        } else {
          // Native: send refresh token from SecureStore in body
          const refreshToken = await getItem("refreshToken");
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });

          if (data.success) {
            await saveTokens(data.data.accessToken, data.data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        await clearTokens();
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth API Calls ────────────────────────────────

export async function register(email: string, password: string, name: string) {
  const { data } = await api.post("/api/auth/register", { email, password, name });
  if (data.success) {
    await saveTokens(data.data.accessToken, data.data.refreshToken);
  }
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/api/auth/login", { email, password });
  if (data.success) {
    await saveTokens(data.data.accessToken, data.data.refreshToken);
  }
  return data;
}

export async function logout() {
  try {
    await api.post("/api/auth/logout");
  } finally {
    await clearTokens();
  }
}

export async function getMe() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post("/api/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const { data } = await api.post("/api/auth/reset-password", { email, code, newPassword });
  return data;
}

export { api };
