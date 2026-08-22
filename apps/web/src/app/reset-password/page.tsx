"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { KeyRound, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) setError("This reset link is missing its token. Please request a new one.")
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      await api.auth.resetPassword({ token, newPassword: password })
      setDone(true)
    } catch {
      setError("This reset link is invalid or has expired. Please request a new one.")
    } finally {
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
        <CardContent className="p-6">
          <div className="flex flex-col items-center pt-4 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {done ? "Your password has been reset" : "Enter a new password for your account"}
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-success" />
              <p className="text-sm text-muted-foreground text-center">
                You can now sign in with your new password.
              </p>
              <Link href="/login" className="w-full">
                <Button className="w-full">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">New password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="pl-9"
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isLoading || !password.trim() || !confirm.trim() || !token}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isLoading ? "Saving..." : "Reset password"}
              </Button>
              <div className="text-center">
                <Link href="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-3 w-3 inline mr-1" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
