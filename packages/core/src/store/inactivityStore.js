import { create } from 'zustand';

const initial = {
  lastInteractionAtMs: Date.now(),
};

export const useInactivityStore = create((set) => ({
  ...initial,
  touch: (atMs = Date.now()) => set({ lastInteractionAtMs: atMs }),
}));

