"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, User, Eye, EyeOff, Github, Chrome, ArrowRight, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

type Mode = "signin" | "signup"

interface FormData {
  name: string
  email: string
  password: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, register, isAuthenticated } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>("signin")

  const redirectTo = searchParams.get("redirect") || "/home"

  useEffect(() => {
    if (isAuthenticated) router.push(redirectTo)
  }, [isAuthenticated, router, redirectTo])

  const [form, setForm] = useState<FormData>({ name: "", email: "", password: "" })
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleChange = useCallback((field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
    setGeneralError(null)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => (prev === "signin" ? "signup" : "signin"))
    setErrors({})
    setGeneralError(null)
    setForm({ name: "", email: "", password: "" })
  }, [])

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email address"
    }
    if (!form.password) {
      newErrors.password = "Password is required"
    } else if (mode === "signup" && form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }
    if (mode === "signup" && !form.name.trim()) {
      newErrors.name = "Name is required"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setGeneralError(null)

    try {
      if (mode === "signin") {
        await login(form.email, form.password)
        toast.success("Signed in successfully")
      } else {
        await register(form.email, form.password, form.name)
        toast.success("Account created successfully")
      }
      setTimeout(() => router.push(redirectTo), 300)
    } catch (err: any) {
      const message = err?.message || "Something went wrong. Please try again."
      setGeneralError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-sm border-border/50 bg-surface shadow-xl">
        <CardContent className="p-0">
          <div className="flex flex-col items-center pt-8 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">FlowMind</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </p>
          </div>

          <div className="flex mx-6 mb-6 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => mode !== "signin" && toggleMode()}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                mode === "signin"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => mode !== "signup" && toggleMode()}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                mode === "signup"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          {generalError && (
            <div className="mx-6 mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={form.name}
                    onChange={handleChange("name")}
                    className={cn("pl-9", errors.name && "border-destructive")}
                    disabled={isLoading}
                  />
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange("email")}
                  className={cn("pl-9", errors.email && "border-destructive")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  value={form.password}
                  onChange={handleChange("password")}
                  className={cn("pl-9 pr-9", errors.password && "border-destructive")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              {mode === "signin" && (
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isLoading
                ? (mode === "signin" ? "Signing in..." : "Creating account...")
                : (mode === "signin" ? "Sign In" : "Create Account")}
            </Button>
          </form>

          <div className="px-6 pb-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2" disabled={isLoading}>
                <Chrome className="h-4 w-4" />
                Google
              </Button>
              <Button variant="outline" className="gap-2" disabled={isLoading}>
                <Github className="h-4 w-4" />
                GitHub
              </Button>
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            <p className="text-center text-xs text-muted-foreground">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-primary hover:underline"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
