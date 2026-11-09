import { Check, Moon, Sun } from "lucide-react";

import { ThemeSwatch } from "@/components/ThemeSwatch";
import { useDefaultEditorLayout, type EditorLayout } from "@/hooks/useEditorLayout";
import { THEME_GROUPS, useTheme, type ThemeName } from "@/theme";

const LAYOUTS: Array<{ value: EditorLayout; label: string; description: string }> = [
  { value: "center", label: "Dialog", description: "Centred over the page" },
  { value: "side", label: "Side panel", description: "Slides in from the left, the page stays in view" },
];

/**
 * How the app looks on this device: the theme, and whether a block opens in a dialog or a side panel (the block
 * editor's default; its own switch still changes one editor at a time). Both apply at once and are kept in this
 * browser, so there is nothing to save.
 */
export function AppearanceCard() {
  const theme = useTheme();
  const [layout, setLayout] = useDefaultEditorLayout();

  return (
    <section id="appearance" className="card scroll-mt-20 p-5 sm:p-7" aria-labelledby="appearance-title">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 id="appearance-title" className="text-base font-semibold tracking-[-0.015em] text-foreground">
            Appearance
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">How klndr. looks on this device.</p>
        </div>
        {/* Unlike the profile above, nothing here waits for a save button */}
        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 text-xs font-medium text-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Saves automatically
        </span>
      </div>

      {/* Theme: follow the device, then the light themes and the dark ones */}
      <div className="border-b border-border py-5">
        <p id="theme-label" className="text-sm font-medium text-foreground">
          Theme
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Pick a look, or let it follow your device's light or dark setting.
        </p>

        <div role="radiogroup" aria-labelledby="theme-label" className="mt-4 space-y-5">
          <button
            type="button"
            role="radio"
            aria-checked={theme.preference === "system"}
            className={[cardClass(theme.preference === "system"), "flex w-full items-center gap-4"].join(" ")}
            onClick={() => theme.setPreference("system")}
          >
            <span className="w-32 shrink-0">
              <ThemeSwatch name="system" size="lg" />
            </span>
            <ChoiceLabel
              selected={theme.preference === "system"}
              label="Match device"
              description="Light or dark, whichever your device is set to"
            />
          </button>

          {THEME_GROUPS.map((group) => (
            <div key={group.scheme}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {group.scheme === "light" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.options.map((option) => (
                  <ThemeCard
                    key={option.name}
                    name={option.name}
                    label={option.label}
                    description={option.description}
                    selected={theme.preference === option.name}
                    onSelect={() => theme.setPreference(option.name)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Where blocks open */}
      <div className="pt-5">
        <p id="layout-label" className="text-sm font-medium text-foreground">
          Open blocks in
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          The default for new and existing blocks. The switch in an editor's corner still changes that one block.
        </p>

        <div role="radiogroup" aria-labelledby="layout-label" className="mt-4 grid gap-3 sm:grid-cols-2">
          {LAYOUTS.map((option) => {
            const selected = layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cardClass(selected)}
                onClick={() => setLayout(option.value)}
              >
                <LayoutPreview layout={option.value} />
                <ChoiceLabel className="mt-2.5" selected={selected} label={option.label} description={option.description} />
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">On phones, blocks always open as a sheet from the bottom.</p>
      </div>
    </section>
  );
}

/** The card around a choice: outlined in the ink when chosen. Shared by the theme cards and the editor layouts. */
const cardClass = (selected: boolean) =>
  [
    "group cursor-pointer rounded-xl border p-2 text-left transition-[border-color,box-shadow,background-color] duration-150",
    selected ? "border-primary bg-card shadow-[0_0_0_1px_var(--primary)]" : "border-border hover:border-input hover:bg-muted/40",
  ].join(" ");

/** A radio dot, a name and a line under it. */
function ChoiceLabel({
  selected,
  label,
  description,
  className = "",
}: {
  selected: boolean;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <span className={["flex min-w-0 items-start gap-2.5 px-1.5 pb-1", className].join(" ")}>
      <span
        aria-hidden="true"
        className={[
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          selected ? "border-primary" : "border-foreground/25 group-hover:border-foreground/40",
        ].join(" ")}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </span>
  );
}

function ThemeCard({
  name,
  label,
  description,
  selected,
  onSelect,
}: {
  name: ThemeName;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={cardClass(selected)} onClick={onSelect}>
      <ThemeSwatch name={name} size="lg" />
      <ChoiceLabel className="mt-2.5" selected={selected} label={label} description={description} />
    </button>
  );
}

/** A small drawing of the planner with a block's editor open in the given layout. */
function LayoutPreview({ layout }: { layout: EditorLayout }) {
  const side = layout === "side";
  return (
    <span aria-hidden="true" className="relative block h-28 overflow-hidden rounded-lg border border-border/80 bg-background">
      {/* The page: a header and a few blocks on a timeline */}
      <span className="absolute inset-x-0 top-0 flex h-4 items-center gap-1 border-b border-border/80 px-2">
        <span className="h-1 w-5 rounded-full bg-foreground/25" />
        <span className="h-1 w-3 rounded-full bg-foreground/10" />
      </span>
      <span className="absolute left-2 right-2 top-6 space-y-1.5">
        <span className="tone-amber tone-chip block h-3 w-[70%] rounded-[3px] border" />
        <span className="tone-indigo tone-chip block h-6 w-[85%] rounded-[3px] border" />
        <span className="tone-emerald tone-chip block h-3 w-[60%] rounded-[3px] border" />
        <span className="tone-rose tone-chip block h-3 w-[75%] rounded-[3px] border" />
      </span>

      {/* The veil and the editor */}
      <span className={["absolute inset-0", side ? "bg-foreground/[0.06]" : "bg-foreground/[0.14]"].join(" ")} />
      <span
        className={[
          "absolute flex flex-col gap-1 rounded-md border border-border bg-card p-1.5 shadow-md transition-transform duration-300",
          side ? "inset-y-1 right-1 w-[42%]" : "left-1/2 top-1/2 h-[62%] w-[48%] -translate-x-1/2 -translate-y-1/2",
        ].join(" ")}
      >
        <span className="flex items-center gap-1">
          <span className="tone-indigo tone-icon h-2.5 w-2.5 rounded-[3px]" />
          <span className="h-1 w-8 rounded-full bg-foreground/35" />
        </span>
        <span className="tone-indigo h-3 rounded-[3px] bg-[color-mix(in_oklab,var(--tone)_22%,var(--card))]" />
        <span className="h-1 w-[80%] rounded-full bg-foreground/10" />
        <span className="h-1 w-[60%] rounded-full bg-foreground/10" />
        <span className="mt-auto flex justify-end gap-0.5">
          <span className="h-2 w-4 rounded-[3px] bg-foreground/10" />
          <span className="h-2 w-4 rounded-[3px] bg-primary" />
        </span>
      </span>
    </span>
  );
}
