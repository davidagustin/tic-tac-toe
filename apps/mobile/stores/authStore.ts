import type { UserProfile } from "@ttt/shared";
import { create } from "zustand";
import * as authService from "../services/auth";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;

  register: (email: string, password: string, name: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  loginAsGuest: () => void;
  updateGuestId: (serverId: string) => void;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: false,
  error: null,

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.register(email, password, name);
      if (result.success) {
        set({ user: result.data.user, isAuthenticated: true, isGuest: false, isLoading: false });
        return true;
      }
      set({ error: result.error, isLoading: false });
      return false;
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Registration failed", isLoading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.login(email, password);
      if (result.success) {
        set({ user: result.data.user, isAuthenticated: true, isGuest: false, isLoading: false });
        return true;
      }
      set({ error: result.error, isLoading: false });
      return false;
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Login failed", isLoading: false });
      return false;
    }
  },

  loginAsGuest: () => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    set({
      user: {
        id: guestId,
        email: "",
        name: `Guest_${Math.floor(Math.random() * 9999)}`,
        rating: 1000,
        stats: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
      },
      isAuthenticated: false,
      isGuest: true,
      isLoading: false,
      error: null,
    });
  },

  updateGuestId: (serverId: string) => {
    const state = get();
    if (state.isGuest && state.user) {
      set({ user: { ...state.user, id: serverId } });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors
    }
    set({ user: null, isAuthenticated: false, isGuest: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const result = await authService.getMe();
      if (result.success) {
        set({ user: result.data, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
