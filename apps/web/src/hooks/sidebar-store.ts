import { create } from "zustand"

interface SidebarState {
  isOpen: boolean
  isMobileOpen: boolean
  isMobile: boolean
  isTablet: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  setResponsive: (isMobile: boolean, isTablet: boolean) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  isMobileOpen: false,
  isMobile: false,
  isTablet: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setMobileOpen: (open) => set({ isMobileOpen: open }),
  setResponsive: (isMobile, isTablet) => set({ isMobile, isTablet }),
}))
