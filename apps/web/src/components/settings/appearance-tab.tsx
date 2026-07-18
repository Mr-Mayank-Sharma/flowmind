"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { GripVertical, Sun, Moon, Monitor, Check } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"

const fontSizes = ["Small", "Medium", "Large"]
const chatDensities = ["Comfortable", "Compact", "Cozy"]

export function AppearanceTab() {
  const { data: user } = useQuery("settings:profile", () => api.settings.getProfile())
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark")
  const [fontSize, setFontSize] = useState("Medium")
  const [density, setDensity] = useState("Comfortable")

  useEffect(() => {
    if (user) {
      if (user.theme) setTheme(user.theme)
      if (user.fontSize) setFontSize(user.fontSize)
      if (user.chatDensity) setDensity(user.chatDensity)
    }
  }, [user])

  const saveAppearance = useCallback(() => {
    api.settings.updateAppearance({ theme, fontSize, chatDensity: density })
  }, [theme, fontSize, density])

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "light" as const, icon: Sun, label: "Light" },
              { value: "dark" as const, icon: Moon, label: "Dark" },
              { value: "system" as const, icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); setTimeout(saveAppearance, 0) }}
                className={`flex flex-col items-center gap-3 rounded-lg border p-6 transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Icon className={`h-8 w-8 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${theme === value ? "text-primary" : ""}`}>{label}</span>
                {theme === value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Font Size</CardTitle>
          <CardDescription>Adjust the text size across the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {fontSizes.map(size => (
              <button
                key={size}
                onClick={() => { setFontSize(size); setTimeout(saveAppearance, 0) }}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  fontSize === size
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <span className={`block font-semibold ${
                  size === "Small" ? "text-xs" : size === "Medium" ? "text-sm" : "text-base"
                }`}>Aa</span>
                <span className="text-xs text-muted-foreground mt-1 block">{size}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat Density</CardTitle>
          <CardDescription>Control spacing in chat conversations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {chatDensities.map(d => (
              <button
                key={d}
                onClick={() => { setDensity(d); setTimeout(saveAppearance, 0) }}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  density === d
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <GripVertical className={`h-5 w-5 mx-auto mb-1 ${
                  density === d ? "text-primary" : "text-muted-foreground"
                }`} />
                <span className={`text-xs font-medium ${density === d ? "text-primary" : ""}`}>{d}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
