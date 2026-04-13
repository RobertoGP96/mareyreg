"use client";

import { useTheme } from "next-themes";
import { useColorTheme } from "@/hooks/use-color-theme";
import { COLOR_PALETTES } from "@/lib/themes";
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
import { cn } from "@/lib/utils";

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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Paleta
        </DropdownMenuLabel>
        <div className="flex flex-col gap-0.5 p-1">
          {COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              onClick={() => setColorTheme(palette.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm w-full hover:bg-accent transition-colors",
                colorTheme === palette.id && "bg-accent"
              )}
            >
              <div className="flex h-5 w-8 rounded-sm overflow-hidden border shrink-0">
                {palette.previewColors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="flex-1 text-left">{palette.label}</span>
              {colorTheme === palette.id && (
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
