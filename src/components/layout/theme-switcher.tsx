"use client";

import { useTheme } from "next-themes";
import { useColorTheme } from "@/hooks/use-color-theme";
import { COLOR_THEMES } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Palette, Sun, Moon, Monitor, Check } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Color
        </DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1 p-2">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setColorTheme(t.id)}
              className="flex items-center justify-center h-8 w-8 rounded-md border hover:scale-110 transition-transform"
              style={{ backgroundColor: t.color }}
              title={t.label}
            >
              {colorTheme === t.id && (
                <Check className="h-3.5 w-3.5 text-white" />
              )}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Modo
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Claro
          {theme === "light" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Oscuro
          {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          Sistema
          {theme === "system" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
