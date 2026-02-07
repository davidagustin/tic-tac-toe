import type { ChatMessage, RoomInfo } from "@ttt/shared";
import { create } from "zustand";

interface LobbyState {
  rooms: RoomInfo[];
  chatMessages: ChatMessage[];
  onlineCount: number;
  isConnected: boolean;

  setRooms: (rooms: RoomInfo[]) => void;
  addRoom: (room: RoomInfo) => void;
  updateRoom: (room: RoomInfo) => void;
  removeRoom: (roomId: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (messages: ChatMessage[]) => void;
  setOnlineCount: (count: number) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  rooms: [],
  chatMessages: [],
  onlineCount: 0,
  isConnected: false,

  setRooms: (rooms) => set({ rooms }),

  addRoom: (room) => set((state) => ({ rooms: [room, ...state.rooms] })),

  updateRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-50),
    })),

  setChatHistory: (messages) => set({ chatMessages: messages }),

  setOnlineCount: (count) => set({ onlineCount: count }),

  setConnected: (connected) => set({ isConnected: connected }),

  reset: () =>
    set({
      rooms: [],
      chatMessages: [],
      onlineCount: 0,
      isConnected: false,
    }),
}));
