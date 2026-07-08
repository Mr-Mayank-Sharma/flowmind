import type { Metadata } from "next"
import "@/styles/globals.css"
import { ThemeProvider } from "@/providers/theme-provider"
import { AuthProvider } from "@/hooks/use-auth"
import { LayoutWithSidebar } from "@/components/layout-with-sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toast"

export const metadata: Metadata = {
  title: {
    default: "FlowMind — Enterprise AI Orchestration Platform",
    template: "%s — FlowMind",
  },
  description: "Next-generation AI Workflow Orchestration Platform. Build, deploy, and monitor AI agents at scale.",
  keywords: ["AI", "workflow", "automation", "agents", "LLM", "orchestration", "enterprise"],
  authors: [{ name: "FlowMind" }],
  openGraph: {
    title: "FlowMind — Enterprise AI Orchestration Platform",
    description: "Build, deploy, and monitor AI agents at scale",
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366f1" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ErrorBoundary>
              <LayoutWithSidebar>{children}</LayoutWithSidebar>
            </ErrorBoundary>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
