const { fontFamily } = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--color-border))",
        input: "hsl(var(--color-border))",
        ring: "hsl(var(--color-primary))",
        background: "hsl(var(--color-background))",
        foreground: "hsl(var(--color-text-primary))",
        primary: {
          DEFAULT: "hsl(var(--color-primary))",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--color-secondary))",
          foreground: "hsl(0 0% 100%)",
        },
        muted: {
          DEFAULT: "hsl(var(--color-background) / 0.8)",
          foreground: "hsl(var(--color-text-secondary))",
        },
        accent: {
          DEFAULT: "hsl(var(--color-secondary) / 0.15)",
          foreground: "hsl(var(--color-text-primary))",
        },
        destructive: {
          DEFAULT: "hsl(var(--color-error))",
          foreground: "hsl(0 0% 100%)",
        },
        success: {
          DEFAULT: "hsl(var(--color-success))",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT: "hsl(var(--color-warning))",
          foreground: "hsl(0 0% 100%)",
        },
        card: {
          DEFAULT: "hsl(var(--color-surface))",
          foreground: "hsl(var(--color-text-primary))",
        },
        popover: {
          DEFAULT: "hsl(var(--color-surface))",
          foreground: "hsl(var(--color-text-primary))",
        },
        "ai-badge": {
          DEFAULT: "hsl(var(--color-ai-badge))",
          foreground: "hsl(0 0% 100%)",
        },
        surface: "hsl(var(--color-surface))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px hsl(var(--color-primary) / 0.3)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--color-primary) / 0.6)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
