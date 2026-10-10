import { toggleTaskLine } from "@klndr/core";
import type { useNotesEditor } from "@klndr/data";
import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";

import { Button, Card, SegmentedControl, Skeleton, Text } from "@/components/ui";
import { useThemeColors } from "@/theme/tokens";
import { MarkdownView } from "./markdown-view";

/** The most a day's notes can hold; the server refuses more. */
const MAX_LENGTH = 20_000;

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/**
 * One day's notes: a Markdown editor and a preview you can switch between. The text, the pause before saving,
 * the rule that the server's copy never overwrites unsaved typing and the retry all come from `@klndr/data`'s
 * `useNotesEditor`, as on the web. An empty note opens straight in the editor, a written one in the preview,
 * where task checkboxes tick in place.
 */
export function NotesPanel({ notes }: { notes: ReturnType<typeof useNotesEditor> }) {
  const colors = useThemeColors();
  // `null` until the reader decides: an empty note opens in the editor, a written one in the preview.
  const [choice, setChoice] = useState<"write" | "preview" | null>(null);
  const mode = choice ?? (notes.text.trim().length === 0 ? "write" : "preview");

  if (notes.state === "loading") {
    return (
      <View accessibilityLabel="Loading notes" className="gap-sm" importantForAccessibility="no">
        <Skeleton height={16} width="66%" />
        <Skeleton height={16} width="50%" />
      </View>
    );
  }

  if (notes.state === "error") {
    return (
      <View className="items-center gap-sm py-lg">
        <Text className="text-center" tone="muted" variant="callout">
          Couldn’t load the notes for this day.
        </Text>
        <Button label="Try again" onPress={notes.retryLoad} variant="surface" />
      </View>
    );
  }

  return (
    <View className="gap-md">
      <View className="flex-row items-center gap-md">
        <SegmentedControl
          className="flex-1"
          label="Notes view"
          onChange={setChoice}
          options={[
            { label: "Write", value: "write" },
            { label: "Preview", value: "preview" },
          ]}
          value={mode}
        />
        <View accessibilityLiveRegion="polite" style={{ minWidth: 92, alignItems: "flex-end" }}>
          {notes.status === "saving" ? (
            <Text tone="muted" variant="caption">
              Saving…
            </Text>
          ) : notes.status === "saved" ? (
            <Text tone="muted" variant="caption">
              Saved
            </Text>
          ) : notes.status === "error" ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={notes.retrySave}>
              <Text tone="destructive" variant="caption">
                Couldn’t save · Retry
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {mode === "write" ? (
        <TextInput
          accessibilityLabel="Notes for this day"
          autoCapitalize="sentences"
          className="rounded-lg bg-card px-md py-md text-foreground"
          maxLength={MAX_LENGTH}
          multiline
          onBlur={() => void notes.saveNow()}
          onChangeText={notes.edit}
          placeholder={"Jot something down…\n\n# Heading   - list   - [ ] task   **bold**   `code`"}
          placeholderTextColor={colors["muted-foreground"]}
          scrollEnabled={false}
          style={{ fontFamily: MONO, fontSize: 15, lineHeight: 22, minHeight: 280, textAlignVertical: "top" }}
          value={notes.text}
        />
      ) : notes.text.trim() ? (
        <Card className="p-md">
          <Pressable
            accessibilityHint="Hold to switch to the editor"
            onLongPress={() => setChoice("write")}
            style={{ minHeight: 120 }}
          >
            <MarkdownView
              onToggleTask={(line) => {
                notes.edit(toggleTaskLine(notes.text, line));
                void notes.saveNow();
              }}
              source={notes.text}
            />
          </Pressable>
        </Card>
      ) : (
        <Text className="px-xs" tone="muted" variant="callout">
          Nothing written yet. Switch to Write to start.
        </Text>
      )}
    </View>
  );
}
