import type { DesktopSettings, WorkspaceSelection } from "@linea/shared";
import { ChevronLeft, X } from "lucide-react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";

export type AppThemeMode = "dark" | "light" | "system";

export type AppSettings = {
  carryRoundedValues: boolean;
  decimalSeparator: "comma" | "dot";
  fontMode: "compact" | "dynamic" | "large";
  precision: number;
  themeMode: AppThemeMode;
};

type SettingsPanelProps = {
  desktopSettings: DesktopSettings;
  onBack: () => void;
  onClose: () => void;
  onCarryRoundedValuesChange: (value: boolean) => void;
  onDecimalSeparatorChange: (value: AppSettings["decimalSeparator"]) => void;
  onFontModeChange: (value: AppSettings["fontMode"]) => void;
  onKeepRunningAfterCloseChange: (value: boolean) => void;
  onLaunchOnLoginChange: (value: boolean) => void;
  onOpenWorkspaceFolder: () => void;
  onPrecisionChange: (value: number) => void;
  onThemeModeChange: (value: AppThemeMode) => void;
  settings: AppSettings;
  workspaceActionError: string | null;
  workspaceActionState: "opening" | null;
  workspaceSelection: WorkspaceSelection | null;
};

export function SettingsPanel({
  desktopSettings,
  onBack,
  onClose,
  onCarryRoundedValuesChange,
  onDecimalSeparatorChange,
  onFontModeChange,
  onKeepRunningAfterCloseChange,
  onLaunchOnLoginChange,
  onOpenWorkspaceFolder,
  onPrecisionChange,
  onThemeModeChange,
  settings,
  workspaceActionError,
  workspaceActionState,
  workspaceSelection,
}: SettingsPanelProps) {
  return (
    <aside className="flex h-full flex-col bg-popover text-popover-foreground">
      <div className="flex items-start justify-between gap-2.5 px-4 pt-3.5">
        <div className="flex items-start gap-2.5">
          <Button
            aria-label="Back to library"
            onClick={onBack}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
              Settings
            </p>
          </div>
        </div>
        <Button
          aria-label="Close"
          onClick={onClose}
          size="icon-sm"
          title="Close"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <Separator className="mt-4 mb-4" />

        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
          <label
            className="text-right text-[0.8125rem] font-medium text-popover-foreground/90"
            htmlFor="settings-precision"
          >
            Precision
          </label>
          <Input
            className="w-16 text-center tabular-nums"
            id="settings-precision"
            inputMode="numeric"
            max={8}
            min={0}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (Number.isFinite(nextValue)) {
                onPrecisionChange(nextValue);
              }
            }}
            step={1}
            type="number"
            value={settings.precision}
          />

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Precision mode
          </span>
          <div className="flex items-center gap-2.5">
            <Checkbox
              aria-label="Carry rounded values"
              checked={settings.carryRoundedValues}
              id="settings-carry-rounded-values"
              onCheckedChange={(checked) =>
                onCarryRoundedValuesChange(checked === true)
              }
            />
            <span className="text-[0.8125rem] font-medium">
              Carry rounded values
            </span>
          </div>

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Decimals
          </span>
          <Select
            onValueChange={(value) =>
              onDecimalSeparatorChange(value as AppSettings["decimalSeparator"])
            }
            value={settings.decimalSeparator}
          >
            <SelectTrigger aria-label="Decimal separator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (12,34)</SelectItem>
              <SelectItem value="dot">Dot (12.34)</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Theme
          </span>
          <Select
            onValueChange={(value) => onThemeModeChange(value as AppThemeMode)}
            value={settings.themeMode}
          >
            <SelectTrigger aria-label="Theme mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Startup
          </span>
          <div className="flex items-center gap-2.5">
            <Checkbox
              aria-label="Launch on login"
              checked={desktopSettings.launchOnLogin}
              id="settings-launch-on-login"
              onCheckedChange={(checked) =>
                onLaunchOnLoginChange(checked === true)
              }
            />
            <span className="text-[0.8125rem] font-medium">
              Launch on login
            </span>
          </div>

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Closing
          </span>
          <div className="flex items-center gap-2.5">
            <Checkbox
              aria-label="Run in background"
              checked={desktopSettings.keepRunningAfterWindowClose}
              id="settings-keep-running-after-close"
              onCheckedChange={(checked) =>
                onKeepRunningAfterCloseChange(checked === true)
              }
            />
            <span className="text-[0.8125rem] font-medium">
              Run in background
            </span>
          </div>

          <span className="text-right text-[0.8125rem] font-medium text-popover-foreground/90">
            Result font
          </span>
          <Select
            onValueChange={(value) =>
              onFontModeChange(value as AppSettings["fontMode"])
            }
            value={settings.fontMode}
          >
            <SelectTrigger aria-label="Result font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="dynamic">Dynamic</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator className="mt-6 mb-4" />

        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
              Workspace
            </p>
            <p className="text-sm font-medium">
              {workspaceSelection?.name ?? "No workspace selected"}
            </p>
            {workspaceSelection ? (
              <p className="text-muted-foreground break-all text-xs leading-5">
                {workspaceSelection.path}
              </p>
            ) : null}
          </div>

          <Button
            disabled={workspaceActionState !== null}
            onClick={onOpenWorkspaceFolder}
            type="button"
          >
            {workspaceActionState === "opening"
              ? "Choosing..."
              : "Choose workspace folder"}
          </Button>

          {workspaceActionError ? (
            <p className="text-sm text-destructive">{workspaceActionError}</p>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
