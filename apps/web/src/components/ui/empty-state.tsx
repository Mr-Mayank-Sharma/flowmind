import { PackageOpen } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick?: () => void; href?: string }
  className?: string
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button variant="outline" size="sm">{action.label}</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  )
}
