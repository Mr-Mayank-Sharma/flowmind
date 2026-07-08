"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, Sparkles, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setIsLoading(false)
    setSent(true)
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
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Reset password</h1>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {sent
                ? "Check your email for a reset link"
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-success" />
              <p className="text-sm text-muted-foreground text-center">
                If an account exists with {email}, you&apos;ll receive a password reset email shortly.
              </p>
              <Link href="/login">
                <Button variant="outline" className="gap-2 mt-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isLoading || !email.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLoading ? "Sending..." : "Send reset link"}
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
