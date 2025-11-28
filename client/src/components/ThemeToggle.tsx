import { useMemo, useCallback } from "react";
import { Moon, Sun, Monitor, Sunset, Waves, TreePine, Book, Eye, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

interface ThemeOption {
  value: Theme;
  label: string;
  icon: typeof Sun;
  description: string;
  bgClass: string;
  iconClass: string;
}

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: Sun, description: "Clean white background", bgClass: "bg-amber-400", iconClass: "text-amber-900" },
  { value: "dim", label: "Dim", icon: Moon, description: "Dark blue background", bgClass: "bg-blue-600", iconClass: "text-white" },
  { value: "lights-out", label: "Lights Out", icon: Monitor, description: "Pure black (AMOLED)", bgClass: "bg-zinc-900", iconClass: "text-white" },
  { value: "sunset", label: "Sunset", icon: Sunset, description: "Warm orange & purple", bgClass: "bg-orange-500", iconClass: "text-white" },
  { value: "ocean", label: "Ocean", icon: Waves, description: "Deep blue & teal", bgClass: "bg-blue-600", iconClass: "text-white" },
  { value: "forest", label: "Forest", icon: TreePine, description: "Dark green theme", bgClass: "bg-green-700", iconClass: "text-white" },
  { value: "sepia", label: "Sepia", icon: Book, description: "Warm reading mode", bgClass: "bg-amber-200", iconClass: "text-amber-900" },
  { value: "high-contrast", label: "High Contrast", icon: Eye, description: "Maximum readability", bgClass: "bg-yellow-400", iconClass: "text-black" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const currentTheme = useMemo(() => 
    themeOptions.find((t) => t.value === theme) || themeOptions[0],
    [theme]
  );
  
  const CurrentIcon = currentTheme.icon;

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, [setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-theme-toggle"
        >
          <CurrentIcon className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Choose Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleThemeChange(option.value);
              }}
              className={`flex items-center gap-3 cursor-pointer ${isSelected ? "bg-accent" : ""}`}
              data-testid={`theme-option-${option.value}`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${option.bgClass} border border-border`}>
                <Icon className={`h-3 w-3 ${option.iconClass}`} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-medium text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, [setTheme]);

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;
        return (
          <Button
            key={option.value}
            variant={isSelected ? "default" : "outline"}
            className={`flex items-center justify-start gap-2 h-auto py-2 px-3 ${isSelected ? "" : "hover-elevate"}`}
            onClick={() => handleThemeChange(option.value)}
            data-testid={`theme-selector-${option.value}`}
          >
            <div className={`h-5 w-5 rounded-full flex items-center justify-center ${option.bgClass} border border-border/50`}>
              <Icon className={`h-2.5 w-2.5 ${option.iconClass}`} />
            </div>
            <span className="text-sm">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
