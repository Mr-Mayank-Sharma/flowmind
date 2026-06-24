"use client"

import { create } from "zustand"

export type ToastVariant = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
    return id
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))

export function useToast() {
  const addToast = useToastStore((s) => s.addToast)
  const dismissToast = useToastStore((s) => s.dismissToast)

  return {
    toast: addToast,
    dismiss: dismissToast,
    success: (title: string, description?: string) => addToast({ title, description, variant: "success" }),
    error: (title: string, description?: string) => addToast({ title, description, variant: "error" }),
    info: (title: string, description?: string) => addToast({ title, description, variant: "info" }),
    warning: (title: string, description?: string) => addToast({ title, description, variant: "warning" }),
  }
}
