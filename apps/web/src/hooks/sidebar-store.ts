import { create } from "zustand"

interface SidebarState {
  isOpen: boolean
  isMobileOpen: boolean
  isMobile: boolean
  isTablet: boolean
  hydrated: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  setResponsive: (isMobile: boolean, isTablet: boolean) => void
  setHydrated: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  isMobileOpen: false,
  isMobile: false,
  isTablet: false,
  hydrated: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setMobileOpen: (open) => set({ isMobileOpen: open }),
  setResponsive: (isMobile, isTablet) => set({ isMobile, isTablet }),
  setHydrated: () => set({ hydrated: true }),
}))
