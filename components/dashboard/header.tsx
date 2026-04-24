"use client"

import { Bell, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-[64px] border-b border-border bg-card shrink-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <h1 className="text-base font-semibold text-foreground whitespace-nowrap">{title}</h1>
        {subtitle && (
          <span className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="relative w-56 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
            className="pl-9 h-8 bg-secondary border-border text-sm"
          />
        </div>

        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-severity-critical" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <User className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="py-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20">
                  <User className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Aymane Fajr</p>
                  <p className="text-xs text-muted-foreground truncate">fajr.aymane@gmail.com</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
