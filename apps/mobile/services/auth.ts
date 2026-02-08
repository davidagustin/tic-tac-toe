import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "../config/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// ─── Token Storage (platform-aware) ────────────────
// expo-secure-store has no web implementation, so we
// fall back to localStorage on web.

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveTokens(accessToken: string, refreshToken?: string) {
  await setItem("accessToken", accessToken);
  if (refreshToken) {
    await setItem("refreshToken", refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return getItem("accessToken");
}

export async function clearTokens() {
  await deleteItem("accessToken");
  await deleteItem("refreshToken");
}

// ─── API Interceptor (auto-refresh) ────────────────

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
        const refreshToken = await getItem("refreshToken");
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        if (data.success) {
          await saveTokens(data.data.accessToken, data.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
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
