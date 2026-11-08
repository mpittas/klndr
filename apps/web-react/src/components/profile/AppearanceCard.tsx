import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useDefaultEditorLayout, type EditorLayout } from "@/hooks/useEditorLayout";
import { useTheme, type ThemePreference } from "@/theme";

const THEMES: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const LAYOUTS: Array<{ value: EditorLayout; label: string; description: string }> = [
  { value: "center", label: "Dialog", description: "Centred over the page" },
  { value: "side", label: "Side panel", description: "Slides in from the right, the page stays in view" },
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
    <section className="card p-5 sm:p-7" aria-labelledby="appearance-title">
      <div className="border-b border-border pb-4">
        <h2 id="appearance-title" className="text-base font-semibold tracking-[-0.015em] text-foreground">
          Appearance
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">How klndr. looks on this device. Changes apply right away.</p>
      </div>

      {/* Theme */}
      <div className="flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="theme-label" className="text-sm font-medium text-foreground">
            Theme
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">System follows your device's light or dark setting.</p>
        </div>
        <div role="radiogroup" aria-labelledby="theme-label" className="segmented h-10 self-start sm:h-9 sm:self-auto">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme.preference === value}
              className="segmented-item flex-none px-3"
              onClick={() => theme.setPreference(value)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {label}
            </button>
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
                className={[
                  "group cursor-pointer rounded-xl border p-2 text-left transition-[border-color,box-shadow,background-color] duration-150",
                  selected
                    ? "border-primary bg-card shadow-[0_0_0_1px_var(--primary)]"
                    : "border-border hover:border-input hover:bg-muted/40",
                ].join(" ")}
                onClick={() => setLayout(option.value)}
              >
                <LayoutPreview layout={option.value} />
                <span className="mt-2.5 flex items-start gap-2.5 px-1.5 pb-1">
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
                    <span className="block text-[13px] font-semibold text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">On phones, blocks always open as a sheet from the bottom.</p>
      </div>
    </section>
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
