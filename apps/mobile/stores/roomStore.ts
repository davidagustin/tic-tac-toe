import type { ChatMessage, RoomDetail, RoomMember, RoomRole } from "@ttt/shared";
import { create } from "zustand";

interface RoomState {
  currentRoom: RoomDetail | null;
  chatMessages: ChatMessage[];
  myRole: RoomRole | null;
  countdown: number | null;

  setRoom: (room: RoomDetail | null) => void;
  addMember: (member: RoomMember) => void;
  removeMember: (userId: string, newHostId?: string) => void;
  setPlayerReady: (userId: string, isReady: boolean) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (messages: ChatMessage[]) => void;
  setMyRole: (role: RoomRole | null) => void;
  setCountdown: (seconds: number | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  chatMessages: [],
  myRole: null,
  countdown: null,

  setRoom: (room) => set({ currentRoom: room }),

  addMember: (member) =>
    set((state) => {
      if (!state.currentRoom) return state;
      const room = { ...state.currentRoom };
      if (member.role === "player") {
        room.players = [...room.players, member];
      } else {
        room.spectators = [...room.spectators, member];
      }
      return { currentRoom: room };
    }),

  removeMember: (userId, newHostId) =>
    set((state) => {
      if (!state.currentRoom) return state;
      const room = {
        ...state.currentRoom,
        players: state.currentRoom.players.filter((m) => m.userId !== userId),
        spectators: state.currentRoom.spectators.filter((m) => m.userId !== userId),
      };
      if (newHostId) {
        room.hostId = newHostId;
      }
      return { currentRoom: room };
    }),

  setPlayerReady: (userId, isReady) =>
    set((state) => {
      if (!state.currentRoom) return state;
      const room = {
        ...state.currentRoom,
        players: state.currentRoom.players.map((p) =>
          p.userId === userId ? { ...p, isReady } : p,
        ),
      };
      return { currentRoom: room };
    }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-50),
    })),

  setChatHistory: (messages) => set({ chatMessages: messages }),

  setMyRole: (role) => set({ myRole: role }),

  setCountdown: (seconds) => set({ countdown: seconds }),

  reset: () =>
    set({
      currentRoom: null,
      chatMessages: [],
      myRole: null,
      countdown: null,
    }),
}));
