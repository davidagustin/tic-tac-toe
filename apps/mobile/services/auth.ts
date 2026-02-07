import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_URL = __DEV__ ? 'http://localhost:3001' : 'https://api.yourdomain.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// ─── Token Storage ─────────────────────────────────

export async function saveTokens(accessToken: string, refreshToken?: string) {
  await SecureStore.setItemAsync('accessToken', accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync('refreshToken', refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('accessToken');
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
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
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
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
  const { data } = await api.post('/api/auth/register', { email, password, name });
  if (data.success) {
    await saveTokens(data.data.accessToken, data.data.refreshToken);
  }
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/api/auth/login', { email, password });
  if (data.success) {
    await saveTokens(data.data.accessToken, data.data.refreshToken);
  }
  return data;
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } finally {
    await clearTokens();
  }
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data;
}

export { api };
